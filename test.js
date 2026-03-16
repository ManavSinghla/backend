const http = require('http');
http.get('http://localhost:5000/api/portfolio', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log(json.summary);
    json.items.forEach(i => console.log(`${i.fund_name}: ${i.action} ${i.amount} (drift: ${i.drift})`));
  });
});
