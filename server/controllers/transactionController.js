import asyncHandler from 'express-async-handler';
import GarbageCan from '../models/garbageCanModel.js';
import { AppError } from '../utils/errorUtils.js';
import Transaction from '../models/transactionModel.js';
import jwt from 'jsonwebtoken';

const addTransaction = asyncHandler(async (req, res, next) => {
  const user = req.user;
  const wasteRecycled = req.body.wasteRecycled;
  const can = await GarbageCan.findById(req.params.id);
  if (!can) {
    next(new AppError('Invalid Garbage Can Id', 400));
  }
  if (can.capacityFilled + wasteRecycled <= can.totalCapacity) {
    const newTransaction = {
      user: user._id,
      garbageCan: can._id,
      wasteRecycled: wasteRecycled,
    };
    const transaction = await Transaction.create(newTransaction);
    user.transactions.push(transaction._id);
    user.ecoCoins += wasteRecycled;
    await user.save();
    can.capacityFilled += wasteRecycled;
    await can.save();
    res.status(201).json({
      message: 'Transaction successful',
      user: user,
    });
  } else {
    next(new AppError('Waste overload! Remove some waste and try again!', 400));
  }
});

const toFixed = (num, fixed) => {
  const re = new RegExp('^-?\\d+(?:.\\d{0,' + (fixed || -1) + '})?');
  return num.toString().match(re)[0];
};

const addTransactionSecure = asyncHandler(async (req, res, next) => {
  const user = req.user;
  const validationToken = req.body.validationToken;
  const can = await GarbageCan.findById(req.params.id);
  if (!can) {
    next(new AppError('Invalid Garbage Can Id', 400));
  }
  const decoded = jwt.verify(validationToken, process.env.JWT_SECRET);
  if (
    decoded.userId === user._id.toString() &&
    decoded.canId === can._id.toString()
  ) {
    const newTransaction = {
      user: user._id,
      garbageCan: can._id,
      wasteRecycled: decoded.waste,
      coinsAwarded: toFixed(decoded.waste * 0.1, 3),
    };
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const transaction = await Transaction.create(newTransaction);
    user.transactions.push(transaction._id);
    user.ecoCoins += transaction.coinsAwarded;
    user.ecoCoins = toFixed(user.ecoCoins, 3);
    await user.save();
    can.capacityFilled += transaction.wasteRecycled;
    can.capacityFilled = toFixed(can.capacityFilled, 3);
    await can.save();
    res.status(201).json({
      status: 'success',
      message: 'Transaction successful',
      newBalance: user.ecoCoins,
    });
  } else {
    next(new AppError('Invalid validation token', 400));
  }
});

export { addTransactionSecure };
