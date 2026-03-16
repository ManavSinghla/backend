require('dotenv').config();
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const mongoose = require('mongoose');

const {
  Client,
  ModelFund,
  ClientHolding,
  RebalanceSession,
  RebalanceItem
} = require('./database');

async function migrate() {
  const db = await open({
    filename: 'C:/LPU/Valuefy/model_portfolio.db',
    driver: sqlite3.Database
  });

  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/portfolio_rebalancing';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  console.log('Clearing existing MongoDB data...');
  await Client.deleteMany({});
  await ModelFund.deleteMany({});
  await ClientHolding.deleteMany({});
  await RebalanceSession.deleteMany({});
  await RebalanceItem.deleteMany({});

  console.log('Starting migration...');

  // 1. Migrate Clients
  try {
      const clients = await db.all('SELECT * FROM clients');
      for (const c of clients) {
        await Client.create({
          client_id: c.client_id,
          client_name: c.client_name,
          total_invested: c.total_invested || 0,
        });
      }
      console.log(`Migrated ${clients.length} clients.`);
  } catch(e) { console.error('Error migrating clients', e); }

  // 2. Migrate Model Funds
  try {
      const modelFunds = await db.all('SELECT * FROM model_funds');
      for (const mf of modelFunds) {
        await ModelFund.create({
          fund_id: mf.fund_id,
          fund_name: mf.fund_name,
          asset_class: mf.asset_class || 'Unknown',
          allocation_pct: mf.allocation_pct,
        });
      }
      console.log(`Migrated ${modelFunds.length} model funds.`);
  } catch(e) { console.error('Error migrating model funds', e); }

  // 3. Migrate Client Holdings
  try {
      const holdings = await db.all('SELECT * FROM client_holdings');
      for (const h of holdings) {
        await ClientHolding.create({
          holding_id: h.holding_id || Math.random().toString(36).substring(2, 10),
          client_id: h.client_id,
          fund_id: h.fund_id,
          fund_name: h.fund_name,
          current_value: h.current_value,
        });
      }
      console.log(`Migrated ${holdings.length} client holdings.`);
  } catch(e) { console.error('Error migrating holdings', e); }

  // 4. Migrate Rebalance Sessions
  try {
      const sessions = await db.all('SELECT * FROM rebalance_sessions');
      for (const s of sessions) {
        await RebalanceSession.create({
          session_id: s.session_id,
          client_id: s.client_id,
          created_at: new Date(s.created_at || Date.now()),
          portfolio_value: s.portfolio_value,
          total_to_buy: s.total_to_buy,
          total_to_sell: s.total_to_sell,
          net_cash_needed: s.net_cash_needed,
          status: s.status,
        });
      }
      console.log(`Migrated ${sessions.length} sessions.`);
  } catch(e) { console.error('Error migrating sessions', e); }

  // 5. Migrate Rebalance Items
  try {
      const items = await db.all('SELECT * FROM rebalance_items');
      for (const i of items) {
        await RebalanceItem.create({
          item_id: i.item_id || Math.random().toString(36).substring(2, 10),
          session_id: i.session_id,
          fund_id: i.fund_id,
          fund_name: i.fund_name,
          action: i.action,
          amount: i.amount,
          current_pct: i.current_pct,
          target_pct: i.target_pct,
          post_rebalance_pct: i.post_rebalance_pct,
          is_model_fund: i.is_model_fund === 1 || i.is_model_fund === true,
        });
      }
      console.log(`Migrated ${items.length} items.`);
  } catch(e) { console.error('Error migrating items', e); }

  console.log('Migration complete!');
  process.exit(0);
}

migrate()
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
