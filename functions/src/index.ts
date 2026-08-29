import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import { onCall, onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getStorage } from "firebase-admin/storage";
import { requireOperator } from "./operator-authorization.js";
import { activatePair as activatePairService, assignPairToCage as assignPairToCageService, cancelBreedingCycle as cancelBreedingCycleService, checkRingIdAvailability as checkRingIdAvailabilityService, closeBreedingCycle as closeBreedingCycleService, closeCageAssignment as closeCageAssignmentService, createBirdFromEgg as createBirdFromEggService, createBreedingCycle as createBreedingCycleService, createExternalBird as createExternalBirdService, deactivatePair as deactivatePairService, movePairToCage as movePairToCageService, reactivatePair as reactivatePairService, retirePair as retirePairService, transitionEggStatus as transitionEggStatusService } from "./services/firestore.js";
import { cancelReservation as cancelReservationService, cancelSale as cancelSaleService, completeSale as completeSaleService, confirmSale as confirmSaleService, createCustomer as createCustomerService, createPriceHistory as createPriceHistoryService, createReservation as createReservationService, createSale as createSaleService, expireReservation as expireReservationService, recordPayment as recordPaymentService, refundPayment as refundPaymentService } from "./services/commercial.js";
import { cancelGiveaway as cancelGiveawayService, completeGiveaway as completeGiveawayService, createGiveaway as createGiveawayService } from "./services/giveaway.js";
import { completeHandover as completeHandoverService, createDelivery as createDeliveryService, rotatePassportToken as rotatePassportTokenService, resolvePassport } from "./services/phase4.js";
import { getBirdDetails as getBirdDetailsService, getCustomerDetails as getCustomerDetailsService, getDashboardSummary as getDashboardSummaryService, getGiveawayDetails as getGiveawayDetailsService, getPairDetails as getPairDetailsService, listBirdPriceHistory as listBirdPriceHistoryService, listBirds as listBirdsService, listBreedingCycles as listBreedingCyclesService, listCages as listCagesService, listCustomers as listCustomersService, listDeliveries as listDeliveriesService, listEggs as listEggsService, listEligibleCompletedSales as listEligibleCompletedSalesService, listGiveaways as listGiveawaysService, listHandovers as listHandoversService, listPairs as listPairsService, listPayments as listPaymentsService, listRefunds as listRefundsService, listReservations as listReservationsService, listSaleTimeline as listSaleTimelineService, listSales as listSalesService } from "./services/reads.js";
import { addBirdDocument as addBirdDocumentService, addBirdPhoto as addBirdPhotoService, archiveBirdDocument as archiveBirdDocumentService, archiveBirdPhoto as archiveBirdPhotoService, beginBirdAssetIntake as beginBirdAssetIntakeService, createCage as createCageService, createEgg as createEggService, createPair as createPairService, finalizeBirdAssetIntake as finalizeBirdAssetIntakeService, recordSexHistory as recordSexHistoryService, recordWeightHistory as recordWeightHistoryService, setPassportPublication as setPassportPublicationService, setPassportStatus as setPassportStatusService, supersedeBirdDocument as supersedeBirdDocumentService } from "./services/phase5c.js";
import { isSupportedPublicPhotoContentType, resolveEligiblePublicPhoto } from "./services/public-media.js";
import { attributedFirestore, withOperatorAttribution } from "./services/audit.js";

setGlobalOptions({ region: "asia-southeast1", minInstances: 0, maxInstances: 2, concurrency: 10 });

initializeApp();
const db = attributedFirestore(getFirestore());
const publicMediaKey = defineSecret("BMB_PUBLIC_MEDIA_KEY");
const operatorOnly = <T>(handler: (data: T) => Promise<unknown>) => onCall(async (request) => {
  requireOperator(request);
  return withOperatorAttribution(request.auth!.uid, () => handler(request.data as T));
});

export const checkRingIdAvailability = operatorOnly<{ ringId: unknown }>((data) => checkRingIdAvailabilityService(db, data));
export const activatePair = operatorOnly<{ pairId: unknown; activeOn: unknown }>((data) => activatePairService(db, data));
export const assignPairToCage = operatorOnly<{ pairId: unknown; cageId: unknown; startsOn: unknown; endsOn?: unknown; notes?: unknown }>((data) => assignPairToCageService(db, data));
export const closeCageAssignment = operatorOnly<{ cageAssignmentId: unknown; endsOn: unknown; endedReason?: unknown }>((data) => closeCageAssignmentService(db, data));
export const movePairToCage = operatorOnly<{ pairId: unknown; cageId: unknown; startsOn: unknown; endedReason?: unknown; notes?: unknown }>((data) => movePairToCageService(db, data));
export const deactivatePair = operatorOnly<{ pairId: unknown; endedOn: unknown; endedReason?: unknown }>((data) => deactivatePairService(db, data));
export const retirePair = operatorOnly<{ pairId: unknown; endedOn: unknown; endedReason?: unknown }>((data) => retirePairService(db, data));
export const reactivatePair = operatorOnly<{ pairId: unknown; activeOn: unknown }>((data) => reactivatePairService(db, data));
export const createBreedingCycle = operatorOnly<{ pairId: unknown; startedOn: unknown; code?: unknown; notes?: unknown }>((data) => createBreedingCycleService(db, data));
export const closeBreedingCycle = operatorOnly<{ breedingCycleId: unknown; endedOn: unknown }>((data) => closeBreedingCycleService(db, data));
export const cancelBreedingCycle = operatorOnly<{ breedingCycleId: unknown; endedOn: unknown }>((data) => cancelBreedingCycleService(db, data));
export const transitionEggStatus = operatorOnly<{ eggId: unknown; targetStatus: unknown }>((data) => transitionEggStatusService(db, data));
export const createBirdFromEgg = operatorOnly<Record<string, unknown>>((data) => createBirdFromEggService(db, data));
export const createExternalBird = operatorOnly<Record<string, unknown>>((data) => createExternalBirdService(db, data));
export const createCustomer = operatorOnly<Record<string, unknown>>((data) => createCustomerService(db, data));
export const createPriceHistory = operatorOnly<Record<string, unknown>>((data) => createPriceHistoryService(db, data));
export const createReservation = operatorOnly<Record<string, unknown>>((data) => createReservationService(db, data));
export const cancelReservation = operatorOnly<Record<string, unknown>>((data) => cancelReservationService(db, data));
export const expireReservation = operatorOnly<Record<string, unknown>>((data) => expireReservationService(db, data));
export const recordPayment = operatorOnly<Record<string, unknown>>((data) => recordPaymentService(db, data));
export const refundPayment = operatorOnly<Record<string, unknown>>((data) => refundPaymentService(db, data));
export const createSale = operatorOnly<Record<string, unknown>>((data) => createSaleService(db, data));
export const confirmSale = operatorOnly<Record<string, unknown>>((data) => confirmSaleService(db, data));
export const completeSale = operatorOnly<Record<string, unknown>>((data) => completeSaleService(db, data));
export const cancelSale = operatorOnly<Record<string, unknown>>((data) => cancelSaleService(db, data));
export const createGiveaway = operatorOnly<Record<string, unknown>>((data) => createGiveawayService(db, data));
export const completeGiveaway = operatorOnly<Record<string, unknown>>((data) => completeGiveawayService(db, data));
export const cancelGiveaway = operatorOnly<Record<string, unknown>>((data) => cancelGiveawayService(db, data));
export const createDelivery = operatorOnly<Record<string, unknown>>((data) => createDeliveryService(db, data));
export const completeHandover = operatorOnly<Record<string, unknown>>((data) => completeHandoverService(db, data));
export const rotatePassportToken = operatorOnly<Record<string, unknown>>((data) => rotatePassportTokenService(db, data));
export const createCage = operatorOnly<Record<string, unknown>>((data) => createCageService(db, data));
export const createPair = operatorOnly<Record<string, unknown>>((data) => createPairService(db, data));
export const createEgg = operatorOnly<Record<string, unknown>>((data) => createEggService(db, data));
export const recordSexHistory = operatorOnly<Record<string, unknown>>((data) => recordSexHistoryService(db, data));
export const recordWeightHistory = operatorOnly<Record<string, unknown>>((data) => recordWeightHistoryService(db, data));
export const addBirdPhoto = operatorOnly<Record<string, unknown>>((data) => addBirdPhotoService(db, data));
export const addBirdDocument = operatorOnly<Record<string, unknown>>((data) => addBirdDocumentService(db, data));
export const beginBirdAssetIntake = operatorOnly<Record<string, unknown>>((data) => beginBirdAssetIntakeService(db, data));
export const finalizeBirdAssetIntake = operatorOnly<Record<string, unknown>>((data) => finalizeBirdAssetIntakeService(db, data));
export const archiveBirdPhoto = operatorOnly<Record<string, unknown>>((data) => archiveBirdPhotoService(db, data));
export const archiveBirdDocument = operatorOnly<Record<string, unknown>>((data) => archiveBirdDocumentService(db, data));
export const supersedeBirdDocument = operatorOnly<Record<string, unknown>>((data) => supersedeBirdDocumentService(db, data));
export const setPassportStatus = operatorOnly<Record<string, unknown>>((data) => setPassportStatusService(db, data));
export const setPassportPublication = operatorOnly<Record<string, unknown>>((data) => setPassportPublicationService(db, data));
export const getDashboardSummary = operatorOnly<Record<string, unknown>>(() => getDashboardSummaryService(db));
export const listBirds = operatorOnly<Record<string, unknown>>((data) => listBirdsService(db, data));
export const listBirdPriceHistory = operatorOnly<Record<string, unknown>>((data) => listBirdPriceHistoryService(db, data));
export const getBirdDetails = operatorOnly<Record<string, unknown>>((data) => getBirdDetailsService(db, data));
export const listCages = operatorOnly<Record<string, unknown>>((data) => listCagesService(db, data));
export const listPairs = operatorOnly<Record<string, unknown>>((data) => listPairsService(db, data));
export const getPairDetails = operatorOnly<Record<string, unknown>>((data) => getPairDetailsService(db, data));
export const listBreedingCycles = operatorOnly<Record<string, unknown>>((data) => listBreedingCyclesService(db, data));
export const listEggs = operatorOnly<Record<string, unknown>>((data) => listEggsService(db, data));
export const listCustomers = operatorOnly<Record<string, unknown>>((data) => listCustomersService(db, data));
export const getCustomerDetails = operatorOnly<Record<string, unknown>>((data) => getCustomerDetailsService(db, data));
export const listReservations = operatorOnly<Record<string, unknown>>((data) => listReservationsService(db, data));
export const listSales = operatorOnly<Record<string, unknown>>((data) => listSalesService(db, data));
export const listSaleTimeline = operatorOnly<Record<string, unknown>>((data) => listSaleTimelineService(db, data));
export const listPayments = operatorOnly<Record<string, unknown>>((data) => listPaymentsService(db, data));
export const listRefunds = operatorOnly<Record<string, unknown>>((data) => listRefundsService(db, data));
export const listGiveaways = operatorOnly<Record<string, unknown>>((data) => listGiveawaysService(db, data));
export const getGiveawayDetails = operatorOnly<Record<string, unknown>>((data) => getGiveawayDetailsService(db, data));
export const listDeliveries = operatorOnly<Record<string, unknown>>((data) => listDeliveriesService(db, data));
export const listHandovers = operatorOnly<Record<string, unknown>>((data) => listHandoversService(db, data));
export const listEligibleCompletedSales = operatorOnly<Record<string, unknown>>((data) => listEligibleCompletedSalesService(db, data));
export const getBirdPassport = onCall({ secrets: [publicMediaKey], minInstances: 0, maxInstances: 1, concurrency: 10, timeoutSeconds: 20 }, async (request) => resolvePassport(db, request.data?.publicToken, publicMediaKey.value()));

const neutralNotFound = (response: import("express").Response) => response.status(404).set({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }).end();
export const servePublicPhoto = onRequest({ secrets: [publicMediaKey], minInstances: 0, maxInstances: 1, concurrency: 2, timeoutSeconds: 30 }, async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    neutralNotFound(response);
    return;
  }
  const handle = request.path.split("/").filter(Boolean).at(-1);
  if (!handle) {
    neutralNotFound(response);
    return;
  }
  const eligible = await resolveEligiblePublicPhoto(db, publicMediaKey.value(), handle);
  if (!eligible) {
    neutralNotFound(response);
    return;
  }
  try {
    const file = getStorage().bucket().file(eligible.storagePath);
    const [metadata] = await file.getMetadata();
    const contentType = isSupportedPublicPhotoContentType(metadata.contentType) ? metadata.contentType : null;
    if (!contentType) {
      neutralNotFound(response);
      return;
    }
    response.status(200).set({ "Content-Type": contentType, "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    file.createReadStream().on("error", () => { if (!response.headersSent) neutralNotFound(response); else response.destroy(); }).pipe(response);
  } catch {
    neutralNotFound(response);
  }
});
