// // src/service/wallet.service.ts

// import Decimal from "decimal.js";
// import { Op, Transaction } from "sequelize";
// import { sequelize } from "../config/Dbconnetion";

// import { AppUser } from "../models/Appuser";
// import { Wallet } from "../models/Wallet";
// import { WalletTransaction } from "../models/walletTransaction.model";
// import { Payout } from "../models/payout.model";

// Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// /* ================================================================
//    CREATE WALLET
// ================================================================ */

// export const createWallet = async (
//   userId: string,
//   walletType: "VENDOR" | "DOCTOR" | "PLATFORM",
//   t?: Transaction
// ) => {
//   const existing = await Wallet.findOne({ where: { userId }, transaction: t });
//   if (existing) return existing;

//   return Wallet.create(
//     {
//       userId,
//       walletType,
//       balance: 0,
//       totalCredited: 0,
//       totalDebited: 0,
//       isActive: true,
//     } as any,
//     { transaction: t }
//   );
// };

// /* ================================================================
//    CREDIT WALLET (Atomic + Locked)
// ================================================================ */

// export const creditWallet = async (params: {
//   userId: string;
//   amount: number;
//   category: "DIARY_SALE" | "MANUAL_CREDIT" | "REFUND" | "COMMISSION" | "ADVANCE PAYMENT";
//   description: string;
//   referenceType?: "ORDER" | "MANUAL" | "REFUND";
//   referenceId?: string;
//   performedBy?: string;
//   metadata?: object;
//   transaction?: Transaction;
// }) => {
//   const run = async (t: Transaction) => {
//     const wallet = await Wallet.findOne({
//       where: { userId: params.userId },
//       transaction: t,
//       lock: t.LOCK.UPDATE,
//     });

//     if (!wallet) throw new Error("Wallet not found");
//     if (!wallet.isActive) throw new Error("Wallet is inactive");

//     const amt = new Decimal(params.amount);
//     if (amt.lte(0)) throw new Error("Credit amount must be positive");

//     // ✅ Idempotency check for ORDER
//     if (params.referenceType === "ORDER" && params.referenceId) {
//       const existingTxn = await WalletTransaction.findOne({
//         where: {
//           walletId: wallet.id,
//           referenceType: "ORDER",
//           referenceId: params.referenceId,
//           type: "CREDIT",
//         },
//         transaction: t,
//       });

//       if (existingTxn) {
//         return { wallet, transaction: existingTxn };
//       }
//     }

//     const newBalance = new Decimal(wallet.balance).plus(amt);

//     wallet.balance = parseFloat(newBalance.toFixed(2));
//     wallet.totalCredited = parseFloat(
//       new Decimal(wallet.totalCredited).plus(amt).toFixed(2)
//     );

//     await wallet.save({ transaction: t });

//     const txn = await WalletTransaction.create(
//       {
//         walletId: wallet.id,
//         type: "CREDIT",
//         amount: parseFloat(amt.toFixed(2)),
//         balanceAfter: wallet.balance,
//         category: params.category,
//         description: params.description,
//         referenceType: params.referenceType || null,
//         referenceId: params.referenceId || null,
//         performedBy: params.performedBy || null,
//         metadata: params.metadata || null,
//       } as any,
//       { transaction: t }
//     );

//     return { wallet, transaction: txn };
//   };

//   return params.transaction
//     ? run(params.transaction)
//     : sequelize.transaction(run);
// };

// /* ================================================================
//    DEBIT WALLET (Atomic + Locked)
// ================================================================ */

// export const debitWallet = async (params: {
//   userId: string;
//   amount: number;
//   category: "PAYOUT" | "MANUAL_DEBIT" | "COMMISSION";
//   description: string;
//   referenceType?: "ORDER" | "PAYOUT" | "MANUAL";
//   referenceId?: string;
//   performedBy?: string;
//   metadata?: object;
//   transaction?: Transaction;
// }) => {
//   const run = async (t: Transaction) => {
//     const wallet = await Wallet.findOne({
//       where: { userId: params.userId },
//       transaction: t,
//       lock: t.LOCK.UPDATE,
//     });

//     if (!wallet) throw new Error("Wallet not found");
//     if (!wallet.isActive) throw new Error("Wallet is inactive");

//     const amt = new Decimal(params.amount);
//     if (amt.lte(0)) throw new Error("Debit amount must be positive");

//     const currentBalance = new Decimal(wallet.balance);

//     if (currentBalance.lt(amt)) {
//       throw new Error(
//         `Insufficient balance. Available ₹${currentBalance.toFixed(
//           2
//         )}, Requested ₹${amt.toFixed(2)}`
//       );
//     }

//     const newBalance = currentBalance.minus(amt);

//     wallet.balance = parseFloat(newBalance.toFixed(2));
//     wallet.totalDebited = parseFloat(
//       new Decimal(wallet.totalDebited).plus(amt).toFixed(2)
//     );

//     await wallet.save({ transaction: t });

//     const txn = await WalletTransaction.create(
//       {
//         walletId: wallet.id,
//         type: "DEBIT",
//         amount: parseFloat(amt.toFixed(2)),
//         balanceAfter: wallet.balance,
//         category: params.category,
//         description: params.description,
//         referenceType: params.referenceType || null,
//         referenceId: params.referenceId || null,
//         performedBy: params.performedBy || null,
//         metadata: params.metadata || null,
//       } as any,
//       { transaction: t }
//     );

//     return { wallet, transaction: txn };
//   };

//   return params.transaction
//     ? run(params.transaction)
//     : sequelize.transaction(run);
// };

// /* ================================================================
//    CREDIT ON DIARY SALE
// ================================================================ */

// export const creditWalletsOnSale = async (params: {
//   orderId: string;
//   vendorId: string;
//   doctorId: string;
//   platformUserId: string;
//   vendorAmount: number;
//   doctorAmount: number;
//   platformAmount: number;
//   transaction?: Transaction;
// }) => {
//   const run = async (t: Transaction) => {
//     const orderRef = {
//       referenceType: "ORDER" as const,
//       referenceId: params.orderId,
//     };

//     const vendor = await creditWallet({
//       userId: params.vendorId,
//       amount: params.vendorAmount,
//       category: "DIARY_SALE",
//       description: `Diary sale commission - Order ${params.orderId}`,
//       ...orderRef,
//       transaction: t,
//     });

//     const doctor = await creditWallet({
//       userId: params.doctorId,
//       amount: params.doctorAmount,
//       category: "DIARY_SALE",
//       description: `Diary sale commission - Order ${params.orderId}`,
//       ...orderRef,
//       transaction: t,
//     });

//     const platform = await creditWallet({
//       userId: params.platformUserId,
//       amount: params.platformAmount,
//       category: "COMMISSION",
//       description: `Platform commission - Order ${params.orderId}`,
//       ...orderRef,
//       transaction: t,
//     });

//     return { vendor, doctor, platform };
//   };

//   return params.transaction
//     ? run(params.transaction)
//     : sequelize.transaction(run);
// };

// /* ================================================================
//    INITIATE PAYOUT (Fixed)
// ================================================================ */

// export const initiatePayout = async (params: {
//   userId: any;
//   amount: number;
//   performedBy: string;
// }) => {
//   return sequelize.transaction(async (t) => {
//     const wallet = await Wallet.findOne({
//       where: { userId: params.userId },
//       transaction: t,
//       lock: t.LOCK.UPDATE,
//     });

//     if (!wallet) throw new Error("Wallet not found");
//     if (!wallet.isActive) throw new Error("Wallet inactive");

//     const amt = new Decimal(params.amount);
//     if (amt.lte(0)) throw new Error("Invalid payout amount");

//     if (new Decimal(wallet.balance).lt(amt)) {
//       throw new Error("Insufficient balance");
//     }

//     const payout = await Payout.create(
//       {
//         walletId: wallet.id,
//         userId: params.userId,
//         amount: parseFloat(amt.toFixed(2)),
//         status: "SUCCESS",
//       } as any,
//       { transaction: t }
//     );

//     await debitWallet({
//       userId: params.userId,
//       amount: params.amount,
//       category: "PAYOUT",
//       description: `Payout - ₹${amt.toFixed(2)}`,
//       referenceType: "PAYOUT",
//       referenceId: payout.id,
//       performedBy: params.performedBy,
//       transaction: t,
//     });

//     return payout;
//   });
// };
// export const getWallet = async (userId: string) => {
//   const wallet = await Wallet.findOne({ where: { userId } });
//   if (!wallet) throw new Error("Wallet not found");
//   return wallet;
// };

// export const getWalletLedger = async (params: any) => {
//   const { userId, page = 1, limit = 20, category, startDate, endDate } = params;

//   const wallet = await Wallet.findOne({ where: { userId } });
//   if (!wallet) throw new Error("Wallet not found");

//   const where: any = { walletId: wallet.id };

//   if (category) where.category = category;
//   if (startDate && endDate)
//     where.createdAt = { [Op.between]: [startDate, endDate] };

//   const offset = (page - 1) * limit;

//   const { count, rows } = await WalletTransaction.findAndCountAll({
//     where,
//     limit,
//     offset,
//     order: [["createdAt", "DESC"]],
//   });

//   return {
//     wallet,
//     transactions: rows,
//     pagination: {
//       total: count,
//       page,
//       limit,
//       totalPages: Math.ceil(count / limit),
//     },
//   };
// };

// export const getAllWalletsSummary = async () => {
//   const wallets = await Wallet.findAll(
//     {
//       include: [
//         {
//           model: AppUser,
//           as: "vendor",
//           attributes: ["id", "fullName", "email", "role"],
//         },
//         {
//             model:WalletTransaction,
//             attributes: ["id", "type", "amount", "category", "createdAt", "referenceType", "referenceId","diaryId"],
//             order: [["createdAt", "DESC"]],
//         },
//         {
//             model:Payout,
//             attributes: ["id", "amount", "status", "createdAt"],
//             order: [["createdAt", "DESC"]],
//         }
//       ],
//     }
//   );
//   return wallets;
// };

// export const manualAdjustment = async (params: any) => {
//   if (params.type === "CREDIT") {
//     return creditWallet({
//       userId: params.userId,
//       amount: params.amount,
//       category: "MANUAL_CREDIT",
//       description: params.description,
//       referenceType: "MANUAL",
//       performedBy: params.performedBy,
//     });
//   }

//   return debitWallet({
//     userId: params.userId,
//     amount: params.amount,
//     category: "MANUAL_DEBIT",
//     description: params.description,
//     referenceType: "MANUAL",
//     performedBy: params.performedBy,
//   });
// };

//   export const reconcileWallet = async (userId: any) =>   {

//     const dbTransaction: Transaction = await sequelize.transaction();

//     try {

//       // 1️⃣ Get wallet
//       const wallet = await Wallet.findOne({
//         where: { userId },
//         transaction: dbTransaction,
//         lock: dbTransaction.LOCK.UPDATE
//       });

//       if (!wallet) {
//         throw new Error("Wallet not found");
//       }

//       // 2️⃣ Calculate total credit
//       const totalCredit = await WalletTransaction.sum("amount", {
//         where: {
//           walletId: wallet.id,
//           type: "CREDIT"
//         },
//         transaction: dbTransaction
//       }) || 0;

//       // 3️⃣ Calculate total debit
//       const totalDebit = await WalletTransaction.sum("amount", {
//         where: {
//           walletId: wallet.id,
//           type: "DEBIT"
//         },
//         transaction: dbTransaction
//       }) || 0;

//       // 4️⃣ Expected balance
//       const expectedBalance = totalCredit - totalDebit;

//       const currentBalance = Number(wallet.balance);

//       // 5️⃣ Check mismatch
//       if (currentBalance !== expectedBalance) {

//         // Update wallet balance
//         wallet.balance = expectedBalance;
//         await wallet.save({ transaction: dbTransaction });

//         await dbTransaction.commit();

//         return {
//           success: true,
//           message: "Wallet reconciled successfully",
//           oldBalance: currentBalance,
//           correctedBalance: expectedBalance
//         };
//       }

//       await dbTransaction.commit();

//       return {
//         success: true,
//         message: "Wallet already reconciled",
//         balance: currentBalance
//       };

//     } catch (error) {
//       await dbTransaction.rollback();
//       throw error;
//     }
//   }

// src/service/wallet.service.ts

import Decimal from "decimal.js";
import { Op, Transaction } from "sequelize";
import { sequelize } from "../config/Dbconnetion";
import { AppUser } from "../models/Appuser";
import { Wallet } from "../models/Wallet";
import { WalletTransaction } from "../models/walletTransaction.model";
import { Payout } from "../models/payout.model";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ════════════════════════════════════════════════════════════════════
// Wallet fields: balance, totalCredited, totalDebited
//
// balance = totalCredited - totalDebited (can go NEGATIVE)
//   Positive balance → vendor has available credit
//   Negative balance → vendor owes platform (payable)
//
// Payable is COMPUTED: Math.abs(balance) when balance < 0
// ════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
// CREATE WALLET
// ════════════════════════════════════════════════════════════════════

export const createWallet = async (
  userId: string,
  walletType: "VENDOR" | "DOCTOR" | "PLATFORM",
  t?: Transaction
) => {
  const existing = await Wallet.findOne({ where: { userId }, transaction: t });
  if (existing) return existing;

  return Wallet.create(
    {
      userId,
      walletType,
      balance: 0,
      totalCredited: 0,
      totalDebited: 0,
      isActive: true,
    } as any,
    { transaction: t }
  );
};

// ════════════════════════════════════════════════════════════════════
// RECORD ADVANCE PAYMENT
//
// Vendor pays SuperAdmin. Credits the wallet.
// If balance was negative (vendor owed money), this reduces the debt.
//
// Example: balance = -3000, advance = 500
//   → totalCredited += 500, balance = -2500 (still owes ₹2500)
//
// Example: balance = -3000, advance = 4000
//   → totalCredited += 4000, balance = 1000 (₹1000 available credit)
// ════════════════════════════════════════════════════════════════════

export const recordAdvancePayment = async (params: {
  vendorId: any;
  amount: number;
  paymentMethod: string;
  paymentReference?: string;
  performedBy: string;
  notes?: string;
}) => {
  return sequelize.transaction(async (t) => {
    const vendor = await AppUser.findOne({ where: { id: params.vendorId }, transaction: t });
    if (!vendor) throw new Error("Vendor not found");
    if (vendor.role !== "VENDOR") throw new Error("User is not a vendor");

    const wallet = await Wallet.findOne({
      where: { userId: params.vendorId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!wallet) throw new Error("Wallet not found");
    if (!wallet.isActive) throw new Error("Wallet is inactive");

    const payment = new Decimal(params.amount);
    if (payment.lte(0)) throw new Error("Amount must be positive");

    const oldBalance = new Decimal(wallet.balance);
    const newBalance = oldBalance.plus(payment);

    wallet.balance = parseFloat(newBalance.toFixed(2));
    wallet.totalCredited = parseFloat(
      new Decimal(wallet.totalCredited).plus(payment).toFixed(2)
    );
    await wallet.save({ transaction: t });

    const txn = await WalletTransaction.create(
      {
        walletId: wallet.id,
        type: "CREDIT",
        amount: parseFloat(payment.toFixed(2)),
        balanceAfter: wallet.balance,
        category: "ADVANCE_PAYMENT",
        description: `Advance via ${params.paymentMethod}${params.notes ? ` — ${params.notes}` : ""}`,
        referenceType: "ADVANCE",
        referenceId: params.paymentReference || null,
        performedBy: params.performedBy,
        metadata: {
          paymentMethod: params.paymentMethod,
          paymentReference: params.paymentReference,
          notes: params.notes,
        },
      } as any,
      { transaction: t }
    );

    const bal = parseFloat(newBalance.toFixed(2));

    return {
      wallet: {
        balance: bal,
        availableCredit: bal > 0 ? bal : 0,
        pendingPayable: bal < 0 ? Math.abs(bal) : 0,
        totalCredited: wallet.totalCredited,
        totalDebited: wallet.totalDebited,
      },
      transaction: txn,
    };
  });
};

// ════════════════════════════════════════════════════════════════════
// ASSIGN DIARIES TO VENDOR
//
// Debits wallet by totalCost = quantity × pricePerDiary.
// Balance CAN go negative — negative = vendor owes platform.
//
// Example: balance = 2000, assign 1 diary at 5000
//   → totalDebited += 5000, balance = -3000 (owes ₹3000)
// ════════════════════════════════════════════════════════════════════


// ════════════════════════════════════════════════════════════════════
// VENDOR CREDIT SUMMARY
// ════════════════════════════════════════════════════════════════════

export const getVendorCreditSummary = async (vendorId: string) => {
  const wallet = await Wallet.findOne({ where: { userId: vendorId } });
  if (!wallet) throw new Error("Wallet not found");

  const totalAdvance =
    (await WalletTransaction.sum("amount", {
      where: { walletId: wallet.id, type: "CREDIT", category: "ADVANCE_PAYMENT" },
    })) || 0;

  const totalDiaryCost =
    (await WalletTransaction.sum("amount", {
      where: { walletId: wallet.id, type: "DEBIT", category: "DIARY_ASSIGNED" },
    })) || 0;

  const diaryAssignments = await WalletTransaction.count({
    where: { walletId: wallet.id, type: "DEBIT", category: "DIARY_ASSIGNED" },
  });

  const bal = Number(wallet.balance);

  return {
    balance: bal,
    availableCredit: bal > 0 ? bal : 0,
    pendingPayable: bal < 0 ? Math.abs(bal) : 0,
    totalAdvancePaid: totalAdvance,
    totalDiaryCost,
    totalAssignments: diaryAssignments,
    totalCredited: wallet.totalCredited,
    totalDebited: wallet.totalDebited,
  };
};

// ════════════════════════════════════════════════════════════════════
// GETTERS
// ════════════════════════════════════════════════════════════════════

export const getWallet = async (userId: string) => {
  const wallet = await Wallet.findOne({ where: { userId } });
  if (!wallet) throw new Error("Wallet not found");

  const bal = Number(wallet.balance);
  return {
    ...wallet.toJSON(),
    availableCredit: bal > 0 ? bal : 0,
    pendingPayable: bal < 0 ? Math.abs(bal) : 0,
  };
};

export const getWalletLedger = async (params: {
  userId: any;
  page?: number;
  limit?: number;
  category?: string;
  startDate?: Date;
  endDate?: Date;
}) => {
  const { userId, page = 1, limit = 20, category, startDate, endDate } = params;

  const wallet = await Wallet.findOne({ where: { userId } });
  if (!wallet) throw new Error("Wallet not found");

  const where: any = { walletId: wallet.id };
  if (category) where.category = category;
  if (startDate && endDate) where.createdAt = { [Op.between]: [startDate, endDate] };

  const offset = (page - 1) * limit;
  const { count, rows } = await WalletTransaction.findAndCountAll({
    where,
    limit,
    offset,
    order: [["createdAt", "DESC"]],
  });

  const bal = Number(wallet.balance);

  return {
    wallet: {
      id: wallet.id,
      balance: bal,
      availableCredit: bal > 0 ? bal : 0,
      pendingPayable: bal < 0 ? Math.abs(bal) : 0,
      totalCredited: wallet.totalCredited,
      totalDebited: wallet.totalDebited,
      walletType: wallet.walletType,
    },
    transactions: rows,
    pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) },
  };
};

export const getAllWalletsSummary = async () => {
  const wallets = await Wallet.findAll({
    include: [
      {
        model: AppUser,
        as: "vendor",
        attributes: ["id", "fullName", "email", "role"],
      },
      {
        model: WalletTransaction,
        attributes: ["id", "type", "amount", "category", "createdAt", "referenceType", "referenceId", "balanceAfter"],
        order: [["createdAt", "DESC"]],
      },
      {
        model: Payout,
        attributes: ["id", "amount", "status", "createdAt"],
        order: [["createdAt", "DESC"]],
      },
    ],
  });

  // Add computed fields to each wallet
  return wallets.map((w) => {
    const bal = Number(w.balance);
    return {
      ...w.toJSON(),
      availableCredit: bal > 0 ? bal : 0,
      pendingPayable: bal < 0 ? Math.abs(bal) : 0,
    };
  });
};

// ════════════════════════════════════════════════════════════════════
// MANUAL ADJUSTMENT
// ════════════════════════════════════════════════════════════════════

export const manualAdjustment = async (params: {
  userId: any;
  type: "CREDIT" | "DEBIT";
  amount: number;
  description: string;
  performedBy: string;
}) => {
  return sequelize.transaction(async (t) => {
    const wallet = await Wallet.findOne({
      where: { userId: params.userId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!wallet) throw new Error("Wallet not found");

    const amt = new Decimal(params.amount);
    if (amt.lte(0)) throw new Error("Amount must be positive");

    const oldBalance = new Decimal(wallet.balance);

    if (params.type === "CREDIT") {
      wallet.balance = parseFloat(oldBalance.plus(amt).toFixed(2));
      wallet.totalCredited = parseFloat(
        new Decimal(wallet.totalCredited).plus(amt).toFixed(2)
      );
    } else {
      wallet.balance = parseFloat(oldBalance.minus(amt).toFixed(2));
      wallet.totalDebited = parseFloat(
        new Decimal(wallet.totalDebited).plus(amt).toFixed(2)
      );
    }

    await wallet.save({ transaction: t });

    const txn = await WalletTransaction.create(
      {
        walletId: wallet.id,
        type: params.type,
        amount: parseFloat(amt.toFixed(2)),
        balanceAfter: wallet.balance,
        category: params.type === "CREDIT" ? "MANUAL_CREDIT" : "MANUAL_DEBIT",
        description: params.description,
        referenceType: "MANUAL",
        performedBy: params.performedBy,
      } as any,
      { transaction: t }
    );

    return { wallet, transaction: txn };
  });
};

// ════════════════════════════════════════════════════════════════════
// PAYOUT
// ════════════════════════════════════════════════════════════════════

export const initiatePayout = async (params: {
  userId: any;
  amount: number;
  performedBy: string;
}) => {
  return sequelize.transaction(async (t) => {
    const wallet = await Wallet.findOne({
      where: { userId: params.userId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!wallet) throw new Error("Wallet not found");
    if (!wallet.isActive) throw new Error("Wallet inactive");

    const amt = new Decimal(params.amount);
    if (amt.lte(0)) throw new Error("Invalid amount");

    const bal = new Decimal(wallet.balance);
    if (bal.lt(amt)) {
      throw new Error(
        `Insufficient balance. Available: ₹${bal.toFixed(2)}, Requested: ₹${amt.toFixed(2)}`
      );
    }

    const payout = await Payout.create(
      {
        walletId: wallet.id,
        userId: params.userId,
        amount: parseFloat(amt.toFixed(2)),
        status: "SUCCESS",
      } as any,
      { transaction: t }
    );

    wallet.balance = parseFloat(bal.minus(amt).toFixed(2));
    wallet.totalDebited = parseFloat(
      new Decimal(wallet.totalDebited).plus(amt).toFixed(2)
    );
    await wallet.save({ transaction: t });

    await WalletTransaction.create(
      {
        walletId: wallet.id,
        type: "DEBIT",
        amount: parseFloat(amt.toFixed(2)),
        balanceAfter: wallet.balance,
        category: "PAYOUT",
        description: `Payout — ₹${amt.toFixed(2)}`,
        referenceType: "PAYOUT",
        referenceId: payout.id,
        performedBy: params.performedBy,
      } as any,
      { transaction: t }
    );

    return payout;
  });
};

// ════════════════════════════════════════════════════════════════════
// RECONCILE
// ════════════════════════════════════════════════════════════════════

export const reconcileWallet = async (userId: any) => {
  const dbTransaction = await sequelize.transaction();
  try {
    const wallet = await Wallet.findOne({
      where: { userId },
      transaction: dbTransaction,
      lock: dbTransaction.LOCK.UPDATE,
    });
    if (!wallet) throw new Error("Wallet not found");

    const totalCredit =
      (await WalletTransaction.sum("amount", {
        where: { walletId: wallet.id, type: "CREDIT" },
        transaction: dbTransaction,
      })) || 0;

    const totalDebit =
      (await WalletTransaction.sum("amount", {
        where: { walletId: wallet.id, type: "DEBIT" },
        transaction: dbTransaction,
      })) || 0;

    const expected = parseFloat(
      new Decimal(totalCredit).minus(totalDebit).toFixed(2)
    );
    const current = Number(wallet.balance);

    if (current !== expected) {
      wallet.balance = expected;
      wallet.totalCredited = totalCredit;
      wallet.totalDebited = totalDebit;
      await wallet.save({ transaction: dbTransaction });
      await dbTransaction.commit();
      return { corrected: true, oldBalance: current, newBalance: expected };
    }

    await dbTransaction.commit();
    return { corrected: false, balance: current };
  } catch (error) {
    await dbTransaction.rollback();
    throw error;
  }
};
export const creditWallet = async (params: {
  userId: string;
  amount: number;
  category: "DIARY_SALE" | "MANUAL_CREDIT" | "REFUND" | "COMMISSION" | "ADVANCE PAYMENT";
  description: string;
  referenceType?: "ORDER" | "MANUAL" | "REFUND";
  referenceId?: string;
  performedBy?: string;
  metadata?: object;
  transaction?: Transaction;
}) => {
  const run = async (t: Transaction) => {
    const wallet = await Wallet.findOne({
      where: { userId: params.userId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!wallet) throw new Error("Wallet not found");
    if (!wallet.isActive) throw new Error("Wallet is inactive");

    const amt = new Decimal(params.amount);
    if (amt.lte(0)) throw new Error("Credit amount must be positive");

    // ✅ Idempotency check for ORDER
    if (params.referenceType === "ORDER" && params.referenceId) {
      const existingTxn = await WalletTransaction.findOne({
        where: {
          walletId: wallet.id,
          referenceType: "ORDER",
          referenceId: params.referenceId,
          type: "CREDIT",
        },
        transaction: t,
      });

      if (existingTxn) {
        return { wallet, transaction: existingTxn };
      }
    }

    const newBalance = new Decimal(wallet.balance).plus(amt);

    wallet.balance = parseFloat(newBalance.toFixed(2));
    wallet.totalCredited = parseFloat(
      new Decimal(wallet.totalCredited).plus(amt).toFixed(2)
    );

    await wallet.save({ transaction: t });

    const txn = await WalletTransaction.create(
      {
        walletId: wallet.id,
        type: "CREDIT",
        amount: parseFloat(amt.toFixed(2)),
        balanceAfter: wallet.balance,
        category: params.category,
        description: params.description,
        referenceType: params.referenceType || null,
        referenceId: params.referenceId || null,
        performedBy: params.performedBy || null,
        metadata: params.metadata || null,
      } as any,
      { transaction: t }
    );

    return { wallet, transaction: txn };
  };

  return params.transaction
    ? run(params.transaction)
    : sequelize.transaction(run);
};

export const creditWalletsOnSale = async (params: {
  orderId: string;
  vendorId: string;
  doctorId: string;
  platformUserId: string;
  vendorAmount: number;
  doctorAmount: number;
  platformAmount: number;
  transaction?: Transaction;
}) => {
  const run = async (t: Transaction) => {
    const orderRef = {
      referenceType: "ORDER" as const,
      referenceId: params.orderId,
    };

    const vendor = await creditWallet({
      userId: params.vendorId,
      amount: params.vendorAmount,
      category: "DIARY_SALE",
      description: `Diary sale commission - Order ${params.orderId}`,
      ...orderRef,
      transaction: t,
    });

    const doctor = await creditWallet({
      userId: params.doctorId,
      amount: params.doctorAmount,
      category: "DIARY_SALE",
      description: `Diary sale commission - Order ${params.orderId}`,
      ...orderRef,
      transaction: t,
    });

    const platform = await creditWallet({
      userId: params.platformUserId,
      amount: params.platformAmount,
      category: "COMMISSION",
      description: `Platform commission - Order ${params.orderId}`,
      ...orderRef,
      transaction: t,
    });

    return { vendor, doctor, platform };
  };

  return params.transaction
    ? run(params.transaction)
    : sequelize.transaction(run);
};