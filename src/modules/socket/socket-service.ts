import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';

import { db } from '@/db';
import { driverCandidates, tripBids, tripLocationUpdates, trips } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Define types for Socket.io events
interface ServerToClientEvents {
  // Trip-related events
  'trip:updated': (tripData: any) => void;
  'trip:driver_assigned': (tripData: any) => void;
  'trip:driver_arriving': (locationData: any) => void;
  'trip:driver_arrived': (tripData: any) => void;
  'trip:started': (tripData: any) => void;
  'trip:completed': (tripData: any) => void;
  'trip:cancelled': (tripData: any) => void;

  // Bidding-related events
  'bid:new': (bidData: any) => void;
  'bid:updated': (bidData: any) => void;
  'bid:selected': (bidData: any) => void;
  'bid:expired': (bidData: any) => void;

  // Location-related events
  'location:update': (locationData: any) => void;

  // Driver matching events
  'drivers:available': (driversData: any) => void;
}

interface ClientToServerEvents {
  // Authentication
  'auth': (userData: { userId: string, userType: string, token: string }, callback: (response: { success: boolean, error?: string }) => void) => void;

  // Trip management
  'trip:request': (tripData: any, callback: (response: { success: boolean, tripId?: string, error?: string }) => void) => void;
  'trip:cancel': (data: { tripId: string }, callback: (response: { success: boolean, error?: string }) => void) => void;
  'trip:start': (data: { tripId: string }, callback: (response: { success: boolean, error?: string }) => void) => void;
  'trip:complete': (data: { tripId: string, finalDistance: number, finalDuration: number }, callback: (response: { success: boolean, error?: string }) => void) => void;

  // Bidding
  'bid:place': (bidData: any, callback: (response: { success: boolean, bidId?: string, error?: string }) => void) => void;
  'bid:select': (data: { tripId: string, bidId: string }, callback: (response: { success: boolean, error?: string }) => void) => void;

  // Location tracking
  'location:update': (locationData: any, callback?: (response: { success: boolean, error?: string }) => void) => void;

  // Room management
  'join:trip': (data: { tripId: string }) => void;
  'leave:trip': (data: { tripId: string }) => void;
}

interface SocketData {
  userId: string;
  userType: 'rider' | 'driver' | 'admin';
  isAuthenticated: boolean;
}

export class SocketService {
  private io: Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

  constructor(httpServer: HttpServer) {
    this.io = new Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(httpServer, {
      cors: {
        origin: '*', // In production, restrict this to your app domains
        methods: ['GET', 'POST'],
      },
    });

    this.setupSocketHandlers();
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('New socket connection:', socket.id);

      // Authentication handler
      socket.on('auth', async (userData, callback) => {
        try {
          // Here you would validate the user's JWT token
          // For now we'll just set the user data on the socket
          socket.data = {
            userId: userData.userId,
            userType: userData.userType as 'rider' | 'driver' | 'admin',
            isAuthenticated: true, // In a real app, verify this with JWT or session
          };

          // Join a room for this specific user (for direct messages)
          socket.join(`user:${userData.userId}`);

          callback({ success: true });
        } catch (error) {
          console.error('Socket auth error:', error);
          callback({ success: false, error: 'Authentication failed' });
        }
      });

      // Handle trip room joining
      socket.on('join:trip', (data) => {
        if (!socket.data.isAuthenticated) return;
        socket.join(`trip:${data.tripId}`);
        console.log(`${socket.data.userType} ${socket.data.userId} joined trip room ${data.tripId}`);
      });

      // Handle trip room leaving
      socket.on('leave:trip', (data) => {
        socket.leave(`trip:${data.tripId}`);
      });

      // Handle bidding
      socket.on('bid:place', async (bidData, callback) => {
        if (!socket.data.isAuthenticated || socket.data.userType !== 'driver') {
          callback({ success: false, error: 'Unauthorized' });
          return;
        }

        try {
          // Save the bid to the database
          const [newBid] = await db.insert(tripBids).values({
            tripId: bidData.tripId,
            driverId: socket.data.userId, // Use the authenticated driver's ID
            vehicleId: bidData.vehicleId,
            bidAmount: bidData.amount,
            note: bidData.note,
            estimatedArrivalTime: bidData.estimatedArrivalTime ? new Date(bidData.estimatedArrivalTime) : undefined,
            lastKnownLocationLat: bidData.locationLat,
            lastKnownLocationLng: bidData.locationLng,
            distanceToPickup: bidData.distanceToPickup,
            timeToPickup: bidData.timeToPickup,
          }).returning();

          // Broadcast the new bid to all users in the trip room
          this.io.to(`trip:${bidData.tripId}`).emit('bid:new', {
            ...newBid,
            driverName: bidData.driverName,  // Include additional driver info
            driverRating: bidData.driverRating,
            vehicleMake: bidData.vehicleMake,
            vehicleModel: bidData.vehicleModel,
          });

          // Also emit to the user's specific room
          const trip = await db.query.trips.findFirst({
            where: (trips, { eq }) => eq(trips.id, bidData.tripId),
            columns: { userId: true }
          });

          if (trip) {
            this.io.to(`user:${trip.userId}`).emit('bid:new', {
              ...newBid,
              driverName: bidData.driverName,
              driverRating: bidData.driverRating,
              vehicleMake: bidData.vehicleMake,
              vehicleModel: bidData.vehicleModel,
            });
          }

          callback({ success: true, bidId: newBid.id });
        } catch (error) {
          console.error('Error placing bid:', error);
          callback({ success: false, error: 'Failed to place bid' });
        }
      });

      // Handle bid selection
      socket.on('bid:select', async (data, callback) => {
        if (!socket.data.isAuthenticated || socket.data.userType !== 'rider') {
          callback({ success: false, error: 'Unauthorized' });
          return;
        }

        try {
          // Verify the user owns this trip
          const trip = await db.query.trips.findFirst({
            where: (trips, { eq, and }) => and(
              eq(trips.id, data.tripId),
              eq(trips.userId, socket.data.userId)
            ),
          });

          if (!trip) {
            callback({ success: false, error: 'Trip not found or not authorized' });
            return;
          }

          // Update the bid as selected
          await db.update(tripBids)
            .set({ isSelected: true, status: 'accepted' })
            .where(eq(tripBids.id, data.bidId));

          // Get the bid with driver info
          const selectedBid = await db.query.tripBids.findFirst({
            where: (bids, { eq }) => eq(bids.id, data.bidId),
            with: {
              driver: {
                columns: {
                  id: true,
                  userId: true,
                  licenseNumber: true
                },
              },
            },
          });

          if (!selectedBid) {
            callback({ success: false, error: 'Bid not found' });
            return;
          }

          // Update the trip with the driver and bid info
          await db.update(trips)
            .set({
              status: 'driver_assigned',
              driverId: selectedBid.driverId,
              selectedBidId: data.bidId,
              bidSelectionTime: new Date(),
              finalPrice: selectedBid.bidAmount, // Set final price to the bid amount
              driverAcceptedAt: new Date(),
            })
            .where(eq(trips.id, data.tripId));

          // Mark all other bids as rejected
          await db.update(tripBids)
            .set({ status: 'rejected' })
            .where(
              eq(tripBids.tripId, data.tripId) &&
              eq(tripBids.isSelected, false)
            );

          // Notify all users in the trip room
          this.io.to(`trip:${data.tripId}`).emit('bid:selected', {
            tripId: data.tripId,
            bidId: data.bidId,
            driverId: selectedBid.driverId,
            driverName: selectedBid.driver?.userId || 'Driver',
          });

          // Notify the specific driver
          this.io.to(`user:${selectedBid.driverId}`).emit('bid:selected', {
            tripId: data.tripId,
            bidId: data.bidId,
            isSelected: true,
          });

          callback({ success: true });
        } catch (error) {
          console.error('Error selecting bid:', error);
          callback({ success: false, error: 'Failed to select bid' });
        }
      });

      // Handle location updates
      socket.on('location:update', async (locationData, callback) => {
        if (!socket.data.isAuthenticated || socket.data.userType !== 'driver') {
          if (callback) callback({ success: false, error: 'Unauthorized' });
          return;
        }

        try {
          // First, update the driver's current location in the database
          if (locationData.tripId) {
            // If this is for a specific trip, save to trip location updates
            await db.insert(tripLocationUpdates).values({
              tripId: locationData.tripId,
              driverId: socket.data.userId,
              locationLat: locationData.lat,
              locationLng: locationData.lng,
              heading: locationData.heading,
              speed: locationData.speed,
              accuracy: locationData.accuracy,
            });

            // Check if trip exists and get rider ID
            const trip = await db.query.trips.findFirst({
              where: (trips, { eq }) => eq(trips.id, locationData.tripId),
              columns: { userId: true, status: true }
            });

            if (trip) {
              // Emit to the trip room
              this.io.to(`trip:${locationData.tripId}`).emit('location:update', {
                ...locationData,
                driverId: socket.data.userId,
                timestamp: new Date(),
              });

              // Also emit directly to the rider
              this.io.to(`user:${trip.userId}`).emit('location:update', {
                ...locationData,
                driverId: socket.data.userId,
                timestamp: new Date(),
              });
            }
          }

          // If we have a search radius, update also the driver candidate
          if (locationData.searchTripId && locationData.searchRadius) {
            // Update driver's location in the driver candidates table
            await db.update(driverCandidates)
              .set({
                lastLocationLat: locationData.lat,
                lastLocationLng: locationData.lng,
                lastLocationTimestamp: new Date(),
              })
              .where(
                eq(driverCandidates.tripId, locationData.searchTripId) &&
                eq(driverCandidates.driverId, socket.data.userId)
              );
          }

          if (callback) callback({ success: true });
        } catch (error) {
          console.error('Error updating location:', error);
          if (callback) callback({ success: false, error: 'Failed to update location' });
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log('Socket disconnected:', socket.id);
      });
    });
  }

  // Public methods to emit events
  public emitTripUpdated(tripId: string, tripData: any) {
    this.io.to(`trip:${tripId}`).emit('trip:updated', tripData);
  }

  public emitDriversAvailable(userId: string, driversData: any) {
    this.io.to(`user:${userId}`).emit('drivers:available', driversData);
  }

  public emitTripStarted(tripId: string, tripData: any) {
    this.io.to(`trip:${tripId}`).emit('trip:started', tripData);
  }

  public emitTripCompleted(tripId: string, tripData: any) {
    this.io.to(`trip:${tripId}`).emit('trip:completed', tripData);
  }

  public emitTripCancelled(tripId: string, tripData: any) {
    this.io.to(`trip:${tripId}`).emit('trip:cancelled', tripData);
  }

  // Method to directly send to a specific user
  public emitToUser(userId: string, eventName: keyof ServerToClientEvents, data: any) {
    this.io.to(`user:${userId}`).emit(eventName, data);
  }
}

let socketService: SocketService | null = null;

export function initializeSocketService(server: HttpServer): SocketService {
  if (!socketService) {
    socketService = new SocketService(server);
  }
  return socketService;
}

export function getSocketService(): SocketService {
  if (!socketService) {
    throw new Error('Socket service not initialized');
  }
  return socketService;
}
