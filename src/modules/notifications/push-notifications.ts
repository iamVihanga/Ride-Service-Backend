import * as admin from 'firebase-admin';
import { app } from 'firebase-admin';
import { BatchResponse, Message, MulticastMessage } from 'firebase-admin/messaging';

import { db } from '@/db';
import env from '@/env';

// Initialize Firebase Admin SDK
let firebaseApp: app.App;
try {
  // Check if app is already initialized to avoid multiple initializations
  firebaseApp = admin.app();
} catch (error) {
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

// Types for notifications
type NotificationType = 'trip_request' | 'bid_placed' | 'bid_selected' | 'driver_arriving' |
  'driver_arrived' | 'trip_started' | 'trip_completed' | 'trip_cancelled' |
  'new_message' | 'payment_completed';

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

/**
 * Send push notification to a single device
 */
export async function sendPushNotification(
  fcmToken: string,
  type: NotificationType,
  payload: NotificationPayload
): Promise<string> {
  try {
    const message: Message = {
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: {
        notificationType: type,
        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        ...(payload.data || {}),
      },
      token: fcmToken,
    };

    const response = await admin.messaging().send(message);
    console.log('Successfully sent notification:', response);
    return response;
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
}

/**
 * Send push notification to multiple devices
 */
export async function sendMulticastPushNotification(
  fcmTokens: string[],
  type: NotificationType,
  payload: NotificationPayload
): Promise<BatchResponse> {
  try {
    if (!fcmTokens.length) {
      throw new Error('No FCM tokens provided');
    }

    const message: MulticastMessage = {
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: {
        notificationType: type,
        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        ...(payload.data || {}),
      },
      tokens: fcmTokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(
      `Successfully sent ${response.successCount} notifications, failed: ${response.failureCount}`
    );
    return response;
  } catch (error) {
    console.error('Error sending multicast notification:', error);
    throw error;
  }
}

/**
 * Send trip request notification to nearby drivers
 */
export async function sendTripRequestToDrivers(
  tripId: string,
  driverIds: string[]
): Promise<void> {
  try {    // Get all the drivers and their FCM tokens
    const drivers = await db.query.drivers.findMany({
      where: (drivers, { inArray }) => inArray(drivers.id, driverIds),
    });

    // Filter out drivers without FCM tokens
    const validDrivers = drivers.filter(driver => driver.fcmToken);

    if (!validDrivers.length) {
      console.warn('No valid FCM tokens found for drivers');
      return;
    }

    // Get trip details
    const trip = await db.query.trips.findFirst({
      where: (trips, { eq }) => eq(trips.id, tripId),
      columns: {
        id: true,
        pickupAddress: true,
        dropoffAddress: true,
        estimatedDistance: true,
        estimatedDuration: true,
        estimatedPrice: true,
        biddingEnabled: true,
      },
    });

    if (!trip) {
      throw new Error(`Trip with ID ${tripId} not found`);
    }

    // Send notifications
    await sendMulticastPushNotification(
      validDrivers.map(d => d.fcmToken!),
      'trip_request',
      {
        title: 'New Ride Request',
        body: `${trip.pickupAddress} to ${trip.dropoffAddress}, ${trip.estimatedDistance.toFixed(1)}km`,
        data: {
          tripId,
          estimatedPrice: trip.estimatedPrice.toString(),
          biddingEnabled: trip.biddingEnabled.toString(),
        },
      }
    );

  } catch (error) {
    console.error('Failed to send trip request notifications:', error);
    throw error;
  }
}

/**
 * Notify rider about a new bid
 */
export async function notifyRiderAboutNewBid(
  tripId: string,
  bidId: string
): Promise<void> {
  try {
    // Get trip with rider FCM token
    const trip = await db.query.trips.findFirst({
      where: (trips, { eq }) => eq(trips.id, tripId),
      columns: {
        id: true,
        userId: true,
        riderFcmToken: true,
      },
    });

    if (!trip || !trip.riderFcmToken) {
      console.warn(`No FCM token found for trip ${tripId}`);
      return;
    }    // Get bid details with driver info
    const bid = await db.query.tripBids.findFirst({
      where: (bids, { eq }) => eq(bids.id, bidId),
      with: {
        driver: true,
      },
    });

    if (!bid) {
      throw new Error(`Bid with ID ${bidId} not found`);
    }

    const arrivalTime = bid.estimatedArrivalTime
      ? new Date(bid.estimatedArrivalTime).getMinutes() - new Date().getMinutes()
      : null;

    const arrivalText = arrivalTime ? ` (${arrivalTime} min away)` : '';

    // Send notification to rider
    await sendPushNotification(
      trip.riderFcmToken,
      'bid_placed',
      {
        title: 'New Bid Received',
        body: `${bid.driver.name} offered ${bid.bidAmount.toFixed(2)}${arrivalText}`,
        data: {
          tripId,
          bidId,
          bidAmount: bid.bidAmount.toString(),
          driverName: bid.driver.name!,
          driverRating: bid.driver.rating?.toString() || '',
        },
      }
    );

  } catch (error) {
    console.error('Failed to notify rider about new bid:', error);
    throw error;
  }
}

/**
 * Notify driver that their bid was selected
 */
export async function notifyDriverAboutBidSelection(
  tripId: string,
  bidId: string
): Promise<void> {
  try {    // Get bid with driver info
    const bid = await db.query.tripBids.findFirst({
      where: (bids, { eq }) => eq(bids.id, bidId),
      with: {
        driver: true,
        trip: true,
      },
    });

    if (!bid || !bid.driver.fcmToken) {
      console.warn(`No FCM token found for bid ${bidId}`);
      return;
    }

    // Send notification to driver
    await sendPushNotification(
      bid.driver.fcmToken,
      'bid_selected',
      {
        title: 'Bid Accepted!',
        body: `Your bid was accepted. Head to pickup at ${bid.trip.pickupAddress}`,
        data: {
          tripId,
          bidId,
        },
      }
    );

  } catch (error) {
    console.error('Failed to notify driver about bid selection:', error);
    throw error;
  }
}

/**
 * Notify other drivers that their bids were rejected
 */
export async function notifyDriversAboutBidRejection(
  tripId: string,
  acceptedBidId: string
): Promise<void> {
  try {    // Get all bids for this trip except the accepted one
    const rejectedBids = await db.query.tripBids.findMany({
      where: (bids, { and, eq, ne }) => and(
        eq(bids.tripId, tripId),
        ne(bids.id, acceptedBidId)
      ),
      with: {
        driver: true,
      },
    });

    // Filter drivers with valid FCM tokens
    const fcmTokens = rejectedBids
      .filter(bid => bid.driver.fcmToken)
      .map(bid => bid.driver.fcmToken!);

    if (!fcmTokens.length) {
      return;
    }

    // Send multicast notification to all rejected drivers
    await sendMulticastPushNotification(
      fcmTokens,
      'bid_placed',
      {
        title: 'Bid Not Selected',
        body: 'The rider has selected another driver for this trip',
        data: {
          tripId,
          status: 'rejected',
        },
      }
    );

  } catch (error) {
    console.error('Failed to notify drivers about bid rejection:', error);
    throw error;
  }
}
