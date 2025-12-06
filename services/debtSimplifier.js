/**
 * Debt Simplification Algorithm
 * Uses a greedy approach to minimize the number of transactions
 * by finding cycles and netting out debts
 */

const simplify = (balances) => {
  if (balances.length === 0) return [];

  // Build net balance map: userId -> net amount (positive = owed to them, negative = they owe)
  const netBalances = new Map();

  for (const balance of balances) {
    const userId = balance.user_id;
    const owesTo = balance.owes_to;
    const amount = parseFloat(balance.amount);

    // User owes amount
    netBalances.set(userId, (netBalances.get(userId) || 0) - amount);
    // owesTo is owed amount
    netBalances.set(owesTo, (netBalances.get(owesTo) || 0) + amount);
  }

  // Separate debtors (negative balance) and creditors (positive balance)
  const debtors = [];
  const creditors = [];

  for (const [userId, netAmount] of netBalances.entries()) {
    if (Math.abs(netAmount) < 0.01) continue; // Skip zero balances

    if (netAmount < 0) {
      debtors.push({ userId, amount: Math.abs(netAmount) });
    } else {
      creditors.push({ userId, amount: netAmount });
    }
  }

  // Sort by amount (largest first)
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const payments = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  // Greedy algorithm: match largest debtor with largest creditor
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];

    if (Math.abs(debtor.amount) < 0.01) {
      debtorIndex++;
      continue;
    }
    if (Math.abs(creditor.amount) < 0.01) {
      creditorIndex++;
      continue;
    }

    const paymentAmount = Math.min(debtor.amount, creditor.amount);

    payments.push({
      from: debtor.userId,
      to: creditor.userId,
      amount: parseFloat(paymentAmount.toFixed(2))
    });

    debtor.amount -= paymentAmount;
    creditor.amount -= paymentAmount;

    if (debtor.amount < 0.01) {
      debtorIndex++;
    }
    if (creditor.amount < 0.01) {
      creditorIndex++;
    }
  }

  return payments;
};

module.exports = {
  simplify
};

