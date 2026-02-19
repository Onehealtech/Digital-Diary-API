// src/service/wallet.service.ts

import Decimal from "decimal.js";
import { Op, Transaction } from "sequelize";
import { sequelize } from "../config/Dbconnetion";

import { AppUser } from "../models/Appuser";
import { Wallet } from "../models/Wallet";
import { WalletTransaction } from "../models/walletTransaction.model";
import { Payout } from "../models/payout.model";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/* ================================================================
   CREATE WALLET
================================================================ */

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

/* ================================================================
   CREDIT WALLET (Atomic + Locked)
================================================================ */

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

/* ================================================================
   DEBIT WALLET (Atomic + Locked)
================================================================ */

export const debitWallet = async (params: {
  userId: string;
  amount: number;
  category: "PAYOUT" | "MANUAL_DEBIT" | "COMMISSION";
  description: string;
  referenceType?: "ORDER" | "PAYOUT" | "MANUAL";
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
    if (amt.lte(0)) throw new Error("Debit amount must be positive");

    const currentBalance = new Decimal(wallet.balance);

    if (currentBalance.lt(amt)) {
      throw new Error(
        `Insufficient balance. Available ₹${currentBalance.toFixed(
          2
        )}, Requested ₹${amt.toFixed(2)}`
      );
    }

    const newBalance = currentBalance.minus(amt);

    wallet.balance = parseFloat(newBalance.toFixed(2));
    wallet.totalDebited = parseFloat(
      new Decimal(wallet.totalDebited).plus(amt).toFixed(2)
    );

    await wallet.save({ transaction: t });

    const txn = await WalletTransaction.create(
      {
        walletId: wallet.id,
        type: "DEBIT",
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

/* ================================================================
   CREDIT ON DIARY SALE
================================================================ */

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

/* ================================================================
   INITIATE PAYOUT (Fixed)
================================================================ */

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
    if (amt.lte(0)) throw new Error("Invalid payout amount");

    if (new Decimal(wallet.balance).lt(amt)) {
      throw new Error("Insufficient balance");
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

    await debitWallet({
      userId: params.userId,
      amount: params.amount,
      category: "PAYOUT",
      description: `Payout - ₹${amt.toFixed(2)}`,
      referenceType: "PAYOUT",
      referenceId: payout.id,
      performedBy: params.performedBy,
      transaction: t,
    });

    return payout;
  });
};
export const getWallet = async (userId: string) => {
  const wallet = await Wallet.findOne({ where: { userId } });
  if (!wallet) throw new Error("Wallet not found");
  return wallet;
};

export const getWalletLedger = async (params: any) => {
  const { userId, page = 1, limit = 20, category, startDate, endDate } = params;

  const wallet = await Wallet.findOne({ where: { userId } });
  if (!wallet) throw new Error("Wallet not found");

  const where: any = { walletId: wallet.id };

  if (category) where.category = category;
  if (startDate && endDate)
    where.createdAt = { [Op.between]: [startDate, endDate] };

  const offset = (page - 1) * limit;

  const { count, rows } = await WalletTransaction.findAndCountAll({
    where,
    limit,
    offset,
    order: [["createdAt", "DESC"]],
  });

  return {
    wallet,
    transactions: rows,
    pagination: {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    },
  };
};

export const getAllWalletsSummary = async () => {
  const wallets = await Wallet.findAll(
    {
      include: [
        {
          model: AppUser,
          as: "vendor",
          attributes: ["id", "fullName", "email", "role"],
        },
        {
            model:WalletTransaction,
            attributes: ["id", "type", "amount", "category", "createdAt", "referenceType", "referenceId","diaryId"],
            order: [["createdAt", "DESC"]],
        },
        {
            model:Payout,
            attributes: ["id", "amount", "status", "createdAt"],
            order: [["createdAt", "DESC"]],
        }
      ],
    }
  );
  return wallets;
};

export const manualAdjustment = async (params: any) => {
  if (params.type === "CREDIT") {
    return creditWallet({
      userId: params.userId,
      amount: params.amount,
      category: "MANUAL_CREDIT",
      description: params.description,
      referenceType: "MANUAL",
      performedBy: params.performedBy,
    });
  }

  return debitWallet({
    userId: params.userId,
    amount: params.amount,
    category: "MANUAL_DEBIT",
    description: params.description,
    referenceType: "MANUAL",
    performedBy: params.performedBy,
  });
};

  export const reconcileWallet = async (userId: any) =>   {

    const dbTransaction: Transaction = await sequelize.transaction();

    try {

      // 1️⃣ Get wallet
      const wallet = await Wallet.findOne({
        where: { userId },
        transaction: dbTransaction,
        lock: dbTransaction.LOCK.UPDATE
      });

      if (!wallet) {
        throw new Error("Wallet not found");
      }

      // 2️⃣ Calculate total credit
      const totalCredit = await WalletTransaction.sum("amount", {
        where: {
          walletId: wallet.id,
          type: "CREDIT"
        },
        transaction: dbTransaction
      }) || 0;

      // 3️⃣ Calculate total debit
      const totalDebit = await WalletTransaction.sum("amount", {
        where: {
          walletId: wallet.id,
          type: "DEBIT"
        },
        transaction: dbTransaction
      }) || 0;

      // 4️⃣ Expected balance
      const expectedBalance = totalCredit - totalDebit;

      const currentBalance = Number(wallet.balance);

      // 5️⃣ Check mismatch
      if (currentBalance !== expectedBalance) {

        // Update wallet balance
        wallet.balance = expectedBalance;
        await wallet.save({ transaction: dbTransaction });

        await dbTransaction.commit();

        return {
          success: true,
          message: "Wallet reconciled successfully",
          oldBalance: currentBalance,
          correctedBalance: expectedBalance
        };
      }

      await dbTransaction.commit();

      return {
        success: true,
        message: "Wallet already reconciled",
        balance: currentBalance
      };

    } catch (error) {
      await dbTransaction.rollback();
      throw error;
    }
  }