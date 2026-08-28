import { AsyncLocalStorage } from "node:async_hooks";
import { Firestore, Transaction } from "firebase-admin/firestore";

const operatorAttribution = new AsyncLocalStorage<string>();

export const withOperatorAttribution = <T>(operatorId: string, operation: () => Promise<T>): Promise<T> =>
  operatorAttribution.run(operatorId, operation);

const actorId = (): string => operatorAttribution.getStore() ?? "system";
const created = (data: FirebaseFirestore.DocumentData): FirebaseFirestore.DocumentData => ({ ...data, createdBy: actorId(), updatedBy: actorId() });
const updated = (data: Record<string, unknown>): Record<string, unknown> => ({ ...data, updatedBy: actorId() });

const attributedTransaction = (transaction: Transaction): Transaction => new Proxy(transaction, {
  get(target, property, receiver) {
    if (property === "create") return (reference: FirebaseFirestore.DocumentReference, data: FirebaseFirestore.DocumentData) => target.create(reference, created(data));
    if (property === "update") return (reference: FirebaseFirestore.DocumentReference, data: Record<string, unknown>) => target.update(reference, updated(data) as never);
    if (property === "set") return (reference: FirebaseFirestore.DocumentReference, data: FirebaseFirestore.DocumentData, options?: FirebaseFirestore.SetOptions) => options ? target.set(reference, created(data), options) : target.set(reference, created(data));
    const value = Reflect.get(target, property, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  },
}) as Transaction;

/**
 * Adds server-derived audit attribution to every transaction write. The UID
 * comes only from operatorOnly; direct service tests use the explicit system
 * actor and cannot impersonate an operator through request payload data.
 */
export const attributedFirestore = (db: Firestore): Firestore => new Proxy(db, {
  get(target, property, receiver) {
    if (property === "runTransaction") return <T>(updateFunction: (transaction: Transaction) => Promise<T>) => target.runTransaction((transaction) => updateFunction(attributedTransaction(transaction)));
    const value = Reflect.get(target, property, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  },
}) as Firestore;
