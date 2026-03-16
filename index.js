const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { connectDB, seedData, Client, ModelFund, ClientHolding, RebalanceSession, RebalanceItem } = require('./database');

const app = express();
app.use(cors());
app.use(express.json());

// API: Get portfolio rebalancing data
app.get('/api/portfolio', async (req, res) => {
  try {
    const clientId = 'C001';
    const holdings = await ClientHolding.find({ client_id: clientId });
    const modelFunds = await ModelFund.find();

    const totalPortfolioValue = holdings.reduce((sum, h) => sum + h.current_value, 0);

    const rebalanceData = [];
    let totalBuy = 0;
    let totalSell = 0;

    // Process Model Funds
    for (const fund of modelFunds) {
      const holding = holdings.find(h => h.fund_id === fund.fund_id);
      const currentValue = holding ? holding.current_value : 0;
      const currentPct = (currentValue / totalPortfolioValue) * 100;
      const drift = fund.allocation_pct - currentPct;

      let action = 'REVIEW';
      let amount = 0;

      if (drift > 0) {
        action = 'BUY';
        amount = (drift / 100) * totalPortfolioValue;
        totalBuy += amount;
      } else if (drift < 0) {
        action = 'SELL';
        amount = Math.abs((drift / 100) * totalPortfolioValue);
        totalSell += amount;
      }

      rebalanceData.push({
        fund_id: fund.fund_id,
        fund_name: fund.fund_name,
        target_pct: fund.allocation_pct,
        current_pct: currentPct,
        current_value: currentValue,
        drift,
        action,
        amount,
        is_model_fund: true
      });
    }

    // Process Non-Model Funds in holdings
    for (const holding of holdings) {
      const isModelFund = modelFunds.some(mf => mf.fund_id === holding.fund_id);
      if (!isModelFund && holding.current_value > 0) {
        const currentPct = (holding.current_value / totalPortfolioValue) * 100;
        rebalanceData.push({
          fund_id: holding.fund_id,
          fund_name: holding.fund_name,
          target_pct: null,
          current_pct: currentPct,
          current_value: holding.current_value,
          drift: null,
          action: 'REVIEW',
          amount: 0,
          is_model_fund: false
        });
      }
    }

    res.json({
      summary: {
        total_portfolio_value: totalPortfolioValue,
        total_buy: totalBuy,
        total_sell: totalSell,
        net_cash_needed: totalBuy - totalSell
      },
      items: rebalanceData
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch portfolio data' });
  }
});

// API: Get Current Holdings
app.get('/api/holdings', async (req, res) => {
  try {
    const clientId = 'C001';
    const holdings = await ClientHolding.find({ client_id: clientId });
    const totalPortfolioValue = holdings.reduce((sum, h) => sum + h.current_value, 0);

    const holdingData = holdings.map(h => ({
      ...h._doc,
      percent_of_portfolio: (h.current_value / totalPortfolioValue) * 100
    }));

    res.json({
      total_portfolio_value: totalPortfolioValue,
      holdings: holdingData
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch holdings' });
  }
});

// API: Get Rebalance History
app.get('/api/history', async (req, res) => {
  try {
    const sessions = await RebalanceSession.find().sort({ created_at: -1 });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// API: Save Rebalance Session
app.post('/api/rebalance/save', async (req, res) => {
  try {
    const clientId = 'C001';
    const { summary, items } = req.body;

    // Check for duplicate: compare with the most recent session
    const lastSession = await RebalanceSession.findOne({ client_id: clientId }).sort({ created_at: -1 });
    if (lastSession) {
      const isSame =
        lastSession.portfolio_value === summary.total_portfolio_value &&
        lastSession.total_to_buy === summary.total_buy &&
        lastSession.total_to_sell === summary.total_sell &&
        lastSession.net_cash_needed === summary.net_cash_needed;

      if (isSame) {
        return res.status(409).json({ error: 'No changes detected. Rebalancing data is identical to the last saved session.' });
      }
    }

    // uuid doesn't exist yet so I'll generate a random string
    const sessionId = Math.random().toString(36).substring(2, 15);

    const session = await RebalanceSession.create({
      session_id: sessionId,
      client_id: clientId,
      portfolio_value: summary.total_portfolio_value,
      total_to_buy: summary.total_buy,
      total_to_sell: summary.total_sell,
      net_cash_needed: summary.net_cash_needed,
      status: 'PENDING'
    });

    const itemsToInsert = items.map(item => ({
      item_id: Math.random().toString(36).substring(2, 15),
      session_id: sessionId,
      fund_id: item.fund_id,
      fund_name: item.fund_name,
      action: item.action,
      amount: item.amount,
      current_pct: item.current_pct,
      target_pct: item.target_pct,
      post_rebalance_pct: ((item.current_value + (item.action === 'BUY' ? item.amount : 0) - (item.action === 'SELL' ? item.amount : 0)) / summary.total_portfolio_value) * 100,
      is_model_fund: item.is_model_fund
    }));

    await RebalanceItem.insertMany(itemsToInsert);
    
    res.json({ success: true, session });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save rebalance session' });
  }
});

// API: Update Model Portfolio
app.put('/api/model-portfolio', async (req, res) => {
  try {
    const { funds } = req.body; // Array of { fund_id, allocation_pct }
    
    if (!Array.isArray(funds) || funds.length !== 5) {
      return res.status(400).json({ error: 'Must provide exactly 5 funds' });
    }

    const totalPct = funds.reduce((sum, f) => sum + f.allocation_pct, 0);
    if (Math.abs(totalPct - 100) > 0.01) { // Floating point comparison
      return res.status(400).json({ error: 'Total allocation must be 100%' });
    }

    // Update each fund
    for (const fund of funds) {
      await ModelFund.updateOne({ fund_id: fund.fund_id }, { allocation_pct: fund.allocation_pct });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update model portfolio' });
  }
});

// API: Get Model Portfolio
app.get('/api/model-portfolio', async (req, res) => {
  try {
    const funds = await ModelFund.find();
    res.json(funds);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch model portfolio' });
  }
});

const PORT = process.env.PORT || 5000;

connectDB().then(async () => {
  await seedData();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
