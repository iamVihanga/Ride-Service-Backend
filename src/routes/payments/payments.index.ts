import { createRouter } from '@/lib/create-app';

import * as handlers from './payments.handlers';
import * as routes from './payments.routes';

const router = createRouter()
  // Payment routes
  .openapi(routes.listPayments, handlers.listPayments)
  .openapi(routes.createPayment, handlers.createPayment)
  .openapi(routes.getPayment, handlers.getPayment)
  .openapi(routes.updatePayment, handlers.updatePayment)
  .openapi(routes.deletePayment, handlers.deletePayment);

export const methodsRouter = createRouter()
  // Payment method routes
  .openapi(routes.listPaymentMethods, handlers.listPaymentMethods)
  .openapi(routes.createPaymentMethod, handlers.createPaymentMethod)
  .openapi(routes.getPaymentMethod, handlers.getPaymentMethod)
  .openapi(routes.updatePaymentMethod, handlers.updatePaymentMethod)
  .openapi(routes.deletePaymentMethod, handlers.deletePaymentMethod);

export const promoCodesRouter = createRouter()
  // Promo code routes
  .openapi(routes.listPromoCodes, handlers.listPromoCodes)
  .openapi(routes.createPromoCode, handlers.createPromoCode)
  .openapi(routes.getPromoCode, handlers.getPromoCode)
  .openapi(routes.updatePromoCode, handlers.updatePromoCode)
  .openapi(routes.deletePromoCode, handlers.deletePromoCode);

export default router;
