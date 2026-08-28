const valueLabels: Record<string, string> = {
  active: "Active", archived: "Archived", cancelled: "Cancelled", closed: "Closed", completed: "Completed",
  confirmed: "Confirmed", deceased: "Deceased", delivered: "Delivered", deposit: "Deposit", disabled: "Disabled",
  discarded: "Discarded", dna: "DNA", draft: "Draft", expired: "Expired", external: "External", female: "Female",
  fertile: "Fertile", final: "Final", farm_hatched: "Farm Hatched", full_refund: "Full Refund", given_away: "Given Away",
  hatched: "Hatched", inactive: "Inactive", infertile: "Infertile", in_transit: "In Transit", laid: "Laid", list: "List",
  lost: "Lost", maintenance: "Maintenance", male: "Male", no_refund: "No Refund", offer: "Offer", other: "Other",
  partial_refund: "Partial Refund", planned: "Planned", published: "Published", purchased: "Purchased", received: "Received",
  rescued: "Rescued", reserved: "Reserved", retired: "Retired", sale: "Sale", sale_payment: "Sale Payment", sex_linked: "Sex Linked",
  sold: "Sold", superseded: "Superseded", unknown: "Unknown", visual: "Visual", voided: "Voided",
};

const fieldLabels: Record<string, string> = {
  activeOn: "Active On", birdId: "Bird ID", breedingCycleId: "Breeding Cycle ID", cageId: "Cage ID",
  customerId: "Customer ID", cycleId: "Cycle ID", deliveryId: "Delivery ID", displayName: "Display Name",
  eggId: "Egg ID", handoverId: "Handover ID", hatchedOn: "Hatched On", laidOn: "Laid On",
  pairId: "Pair ID", passportStatus: "Passport Status", paymentId: "Payment ID", publicToken: "Public Token",
  reservationId: "Reservation ID", ringId: "Ring ID", saleId: "Sale ID", sequenceNo: "Sequence No.",
  startedOn: "Started On", status: "Status",
};

export const displayValue = (value: unknown) => valueLabels[String(value)] ?? String(value ?? "-");
export const displayFieldName = (value: string) => fieldLabels[value] ?? value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, letter => letter.toUpperCase());
