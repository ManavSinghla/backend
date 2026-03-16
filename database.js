const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  client_id: { type: String, required: true, unique: true },
  client_name: { type: String, required: true },
  total_invested: { type: Number, required: true }
});

const modelFundSchema = new mongoose.Schema({
  fund_id: { type: String, required: true, unique: true },
  fund_name: { type: String, required: true },
  asset_class: { type: String },
  allocation_pct: { type: Number, required: true }
});

const clientHoldingSchema = new mongoose.Schema({
  holding_id: { type: String, required: true, unique: true },
  client_id: { type: String, required: true },
  fund_id: { type: String, required: true },
  fund_name: { type: String, required: true },
  current_value: { type: Number, required: true }
});

const rebalanceSessionSchema = new mongoose.Schema({
  session_id: { type: String, required: true, unique: true },
  client_id: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  portfolio_value: { type: Number, required: true },
  total_to_buy: { type: Number, required: true },
  total_to_sell: { type: Number, required: true },
  net_cash_needed: { type: Number, required: true },
  status: { type: String, enum: ['PENDING', 'APPLIED', 'DISMISSED'], default: 'PENDING' }
});

const rebalanceItemSchema = new mongoose.Schema({
  item_id: { type: String, required: true, unique: true },
  session_id: { type: String, required: true },
  fund_id: { type: String, required: true },
  fund_name: { type: String, required: true },
  action: { type: String, enum: ['BUY', 'SELL', 'REVIEW'], required: true },
  amount: { type: Number, required: true },
  current_pct: { type: Number, required: true },
  target_pct: { type: Number },
  post_rebalance_pct: { type: Number, required: true },
  is_model_fund: { type: Boolean, required: true }
});

const Client = mongoose.model('Client', clientSchema);
const ModelFund = mongoose.model('ModelFund', modelFundSchema);
const ClientHolding = mongoose.model('ClientHolding', clientHoldingSchema);
const RebalanceSession = mongoose.model('RebalanceSession', rebalanceSessionSchema);
const RebalanceItem = mongoose.model('RebalanceItem', rebalanceItemSchema);

async function connectDB() {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/portfolio_rebalancing';
    await mongoose.connect(uri);
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

async function seedData() {
  const count = await Client.countDocuments();
  if (count > 0) {
    console.log('Data already seeded');
    return;
  }

  const clientId = 'C001';
  await Client.create({
    client_id: clientId,
    client_name: 'Amit Sharma',
    total_invested: 500000 // Sample value, portfolio value will be calculated
  });

  const modelFunds = [
    { fund_id: 'F001', fund_name: 'Mirae Asset Large Cap Fund', asset_class: 'Equity', allocation_pct: 30 },
    { fund_id: 'F002', fund_name: 'Parag Parikh Flexi Cap Fund', asset_class: 'Equity', allocation_pct: 25 },
    { fund_id: 'F003', fund_name: 'HDFC Mid Cap Opportunities Fund', asset_class: 'Equity', allocation_pct: 20 },
    { fund_id: 'F004', fund_name: 'ICICI Prudential Bond Fund', asset_class: 'Debt', allocation_pct: 15 },
    { fund_id: 'F005', fund_name: 'Nippon India Gold ETF', asset_class: 'Commodity', allocation_pct: 10 },
  ];
  await ModelFund.insertMany(modelFunds);

  const holdings = [
    { holding_id: 'H001', client_id: clientId, fund_id: 'F001', fund_name: 'Mirae Asset Large Cap Fund', current_value: 90000 },
    { holding_id: 'H002', client_id: clientId, fund_id: 'F002', fund_name: 'Parag Parikh Flexi Cap Fund', current_value: 155000 },
    // F003 is 0, we can omit it or insert with value 0, let's omit as per common practice, or insert 0. Let's insert 0.
    { holding_id: 'H003', client_id: clientId, fund_id: 'F004', fund_name: 'ICICI Prudential Bond Fund', current_value: 110000 },
    { holding_id: 'H004', client_id: clientId, fund_id: 'F005', fund_name: 'Nippon India Gold ETF', current_value: 145000 },
    { holding_id: 'H005', client_id: clientId, fund_id: 'F006', fund_name: 'Axis Bluechip Fund', current_value: 80000 },
  ];
  await ClientHolding.insertMany(holdings);

  console.log('Seeding completed');
}

module.exports = {
  Client, ModelFund, ClientHolding, RebalanceSession, RebalanceItem, connectDB, seedData
};
