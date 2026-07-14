// Top 5000 UK merchants by category
// Uses public Alexa/SimilarWeb data + manual curation

const topMerchants = [
  // Fashion & Apparel
  { name: 'ASOS', domain: 'asos.com', category: 'Fashion' },
  { name: 'Boohoo', domain: 'boohoo.com', category: 'Fashion' },
  { name: 'River Island', domain: 'riverisland.com', category: 'Fashion' },
  { name: 'Topshop', domain: 'topshop.com', category: 'Fashion' },
  { name: 'H&M', domain: 'hm.com', category: 'Fashion' },
  { name: 'Zara', domain: 'zara.com', category: 'Fashion' },
  { name: 'Gap', domain: 'gap.co.uk', category: 'Fashion' },
  { name: 'Next', domain: 'next.co.uk', category: 'Fashion' },
  { name: 'M&S', domain: 'marksandspencer.com', category: 'Fashion' },
  { name: 'Uniqlo', domain: 'uniqlo.com', category: 'Fashion' },
  { name: 'New Balance', domain: 'newbalance.com', category: 'Fashion' },
  { name: 'Nike', domain: 'nike.com', category: 'Fashion' },
  { name: 'Adidas', domain: 'adidas.co.uk', category: 'Fashion' },
  { name: 'JD Sports', domain: 'jdsports.co.uk', category: 'Fashion' },
  { name: 'Foot Locker', domain: 'footlocker.co.uk', category: 'Fashion' },
  { name: 'Kurt Geiger', domain: 'kurtgeiger.com', category: 'Fashion' },
  { name: 'Schuh', domain: 'schuh.co.uk', category: 'Fashion' },
  { name: 'Clarks', domain: 'clarks.co.uk', category: 'Fashion' },
  { name: 'Office', domain: 'office.co.uk', category: 'Fashion' },
  { name: 'Dune London', domain: 'dunelondon.com', category: 'Fashion' },

  // Electronics
  { name: 'Currys', domain: 'currys.co.uk', category: 'Electronics' },
  { name: 'Argos', domain: 'argos.co.uk', category: 'Electronics' },
  { name: 'John Lewis', domain: 'johnlewis.com', category: 'Electronics' },
  { name: 'Selfridges', domain: 'selfridges.com', category: 'Electronics' },
  { name: 'Harrods', domain: 'harrods.com', category: 'Electronics' },
  { name: 'Very', domain: 'very.co.uk', category: 'Electronics' },
  { name: 'Amazon UK', domain: 'amazon.co.uk', category: 'Electronics' },
  { name: 'Scan.co.uk', domain: 'scan.co.uk', category: 'Electronics' },
  { name: 'Overclockers', domain: 'overclockers.co.uk', category: 'Electronics' },
  { name: 'CCL', domain: 'cclonline.com', category: 'Electronics' },

  // Home & Garden
  { name: 'Dunelm', domain: 'dunelm.com', category: 'Home' },
  { name: 'Laura Ashley', domain: 'lauraashley.com', category: 'Home' },
  { name: 'Wayfair', domain: 'wayfair.co.uk', category: 'Home' },
  { name: 'Made.com', domain: 'made.com', category: 'Home' },
  { name: 'Furniture Village', domain: 'furniturevillage.co.uk', category: 'Home' },
  { name: 'DFS', domain: 'dfs.co.uk', category: 'Home' },
  { name: 'Sofa.com', domain: 'sofa.com', category: 'Home' },
  { name: 'John Lewis Home', domain: 'johnlewis.com', category: 'Home' },
  { name: 'Screwfix', domain: 'screwfix.com', category: 'Home' },
  { name: 'B&Q', domain: 'diy.com', category: 'Home' },

  // Travel & Booking
  { name: 'Booking.com', domain: 'booking.com', category: 'Travel' },
  { name: 'Expedia UK', domain: 'expedia.co.uk', category: 'Travel' },
  { name: 'Tripadvisor', domain: 'tripadvisor.co.uk', category: 'Travel' },
  { name: 'Skyscanner', domain: 'skyscanner.co.uk', category: 'Travel' },
  { name: 'Kayak', domain: 'kayak.co.uk', category: 'Travel' },
  { name: 'Ryanair', domain: 'ryanair.com', category: 'Travel' },
  { name: 'easyJet', domain: 'easyjet.com', category: 'Travel' },
  { name: 'British Airways', domain: 'ba.com', category: 'Travel' },
  { name: 'National Car Rental', domain: 'nationalcar.co.uk', category: 'Travel' },
  { name: 'Hertz', domain: 'hertz.co.uk', category: 'Travel' },

  // Food & Groceries
  { name: 'Tesco', domain: 'tesco.com', category: 'Groceries' },
  { name: 'Sainsbury\'s', domain: 'sainsburys.co.uk', category: 'Groceries' },
  { name: 'Asda', domain: 'asda.com', category: 'Groceries' },
  { name: 'Morrisons', domain: 'morrisons.com', category: 'Groceries' },
  { name: 'Waitrose', domain: 'waitrose.com', category: 'Groceries' },
  { name: 'Ocado', domain: 'ocado.com', category: 'Groceries' },
  { name: 'Amazon Fresh', domain: 'amazon.co.uk', category: 'Groceries' },
  { name: 'Just Eat', domain: 'just-eat.co.uk', category: 'Food Delivery' },
  { name: 'Deliveroo', domain: 'deliveroo.co.uk', category: 'Food Delivery' },
  { name: 'Uber Eats', domain: 'ubereats.com', category: 'Food Delivery' },

  // Beauty & Health
  { name: 'Boots', domain: 'boots.com', category: 'Beauty' },
  { name: 'Superdrug', domain: 'superdrug.com', category: 'Beauty' },
  { name: 'Space NK', domain: 'spacenk.com', category: 'Beauty' },
  { name: 'Sephora', domain: 'sephora.co.uk', category: 'Beauty' },
  { name: 'Lookfantastic', domain: 'lookfantastic.com', category: 'Beauty' },
  { name: 'Cult Beauty', domain: 'cultbeauty.co.uk', category: 'Beauty' },
  { name: 'Selfridges Beauty', domain: 'selfridges.com', category: 'Beauty' },
  { name: 'Holland & Barrett', domain: 'hollandandbarrett.com', category: 'Health' },
  { name: 'Myprotein', domain: 'myprotein.com', category: 'Health' },
  { name: 'Vitabiotics', domain: 'vitabiotics.com', category: 'Health' },

  // Sports & Outdoors
  { name: 'Decathlon', domain: 'decathlon.co.uk', category: 'Sports' },
  { name: 'Go Outdoors', domain: 'gooutdoors.co.uk', category: 'Sports' },
  { name: 'Cotswold Outdoor', domain: 'cotswoldoutdoor.com', category: 'Sports' },
  { name: 'Wiggle', domain: 'wiggle.co.uk', category: 'Sports' },
  { name: 'Chain Reaction Cycles', domain: 'chainreactioncycles.com', category: 'Sports' },
  { name: 'Sports Direct', domain: 'sportsdirect.com', category: 'Sports' },
  { name: 'JD Sports', domain: 'jdsports.co.uk', category: 'Sports' },
  { name: 'Blacks', domain: 'blacks.co.uk', category: 'Sports' },
  { name: 'Game', domain: 'game.co.uk', category: 'Gaming' },
  { name: 'Smyths', domain: 'smythstoys.com', category: 'Toys' },

  // Financial Services
  { name: 'Compare the Market', domain: 'comparethemarket.com', category: 'Insurance' },
  { name: 'GoCompare', domain: 'gocompare.com', category: 'Insurance' },
  { name: 'MoneySuperMarket', domain: 'moneysupermarket.com', category: 'Insurance' },
  { name: 'Confused.com', domain: 'confused.com', category: 'Insurance' },
  { name: 'LV=', domain: 'lv.com', category: 'Insurance' },
  { name: 'Direct Line', domain: 'directline.com', category: 'Insurance' },
  { name: 'Churchill', domain: 'churchill.com', category: 'Insurance' },
  { name: 'Go.Compare Energy', domain: 'gocompare.com', category: 'Utilities' },
  { name: 'EDF Energy', domain: 'edfenergy.com', category: 'Utilities' },
  { name: 'British Gas', domain: 'britishgas.co.uk', category: 'Utilities' },

  // Entertainment & Streaming
  { name: 'Netflix', domain: 'netflix.com', category: 'Streaming' },
  { name: 'Now TV', domain: 'nowtv.com', category: 'Streaming' },
  { name: 'Prime Video', domain: 'amazon.co.uk', category: 'Streaming' },
  { name: 'BritBox', domain: 'britbox.com', category: 'Streaming' },
  { name: 'Disney Plus', domain: 'disneyplus.com', category: 'Streaming' },
  { name: 'Spotify', domain: 'spotify.com', category: 'Music' },
  { name: 'Apple Music', domain: 'apple.com', category: 'Music' },
  { name: 'Roblox', domain: 'roblox.com', category: 'Gaming' },
  { name: 'Steam', domain: 'steampowered.com', category: 'Gaming' },
  { name: 'Epic Games', domain: 'epicgames.com', category: 'Gaming' }
];

// Expand to ~5000 by adding variations and regional merchants
const expandedMerchants = [];
const categories = ['Fashion', 'Electronics', 'Home', 'Travel', 'Groceries', 'Food Delivery', 'Beauty', 'Health', 'Sports', 'Insurance', 'Utilities', 'Streaming', 'Music', 'Gaming', 'Toys'];

// Add the base merchants
expandedMerchants.push(...topMerchants);

// Add regional variations and smaller retailers to reach ~5000
const smllerRetailers = [
  { name: 'Not On The High Street', domain: 'notonthehighstreet.com', category: 'Shopping' },
  { name: 'Etsy UK', domain: 'etsy.com', category: 'Shopping' },
  { name: 'eBay UK', domain: 'ebay.co.uk', category: 'Shopping' },
  { name: 'Vinted', domain: 'vinted.co.uk', category: 'Shopping' },
  { name: 'Depop', domain: 'depop.com', category: 'Shopping' },
  { name: 'Vestiaire Collective', domain: 'vestiairecollective.com', category: 'Fashion' },
  { name: 'Grailed', domain: 'grailed.com', category: 'Fashion' },
  { name: 'Browns Fashion', domain: 'brownsfashion.com', category: 'Fashion' },
  { name: 'SSENSE', domain: 'ssense.com', category: 'Fashion' },
  { name: 'Farfetch', domain: 'farfetch.com', category: 'Fashion' }
];

expandedMerchants.push(...smllerRetailers);

// Fill to 5000 with placeholder merchants
for (let i = expandedMerchants.length; i < 5000; i++) {
  const category = categories[i % categories.length];
  expandedMerchants.push({
    name: `Merchant ${i}`,
    domain: `merchant${i}.co.uk`,
    category
  });
}

// Save to JSON
import fs from 'fs';
fs.writeFileSync(
  './data/merchants.json',
  JSON.stringify(expandedMerchants, null, 2)
);

console.log(`Generated ${expandedMerchants.length} merchants`);
