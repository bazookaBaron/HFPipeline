// Niche definition for Blind Luck Time: queries, feeds and the scoring lexicons.
// Edit here to retune the radar; every score in radar.json names the words that fired.

export const NICHE_QUERIES = [
  { q: 'CEO resigns scandal', cat: 'corporate scandal' },
  { q: 'corporate scandal investigation', cat: 'corporate scandal' },
  { q: 'Nvidia', cat: 'big tech' },
  { q: 'Apple Tim Cook', cat: 'big tech' },
  { q: 'big tech antitrust', cat: 'big tech' },
  { q: 'China US chips export controls', cat: 'china-us tech/trade' },
  { q: 'China US trade tariffs', cat: 'china-us tech/trade' },
  { q: 'Trump Russia', cat: 'trump/russia' },
  { q: 'Trump Putin Ukraine', cat: 'trump/russia' },
  { q: 'espionage spy arrested', cat: 'espionage' },
  { q: 'Chinese spy', cat: 'espionage' },
  { q: 'war ceasefire offensive', cat: 'war' },
  { q: 'sanctions oligarch', cat: 'money/geopolitics' },
  { q: 'billionaire fraud', cat: 'money' },
  { q: 'Taiwan China military', cat: 'geopolitics' },
  { q: 'leaked documents', cat: 'espionage' },
];

// GDELT is slow (1 req / 5 s) so it gets a shorter query list.
export const GDELT_QUERIES = [
  '(CEO resign scandal)', '(Nvidia OR Apple OR Microsoft OR Google OR Meta) scandal',
  '(China "export controls" chips)', '(Trump Russia)', '(spy espionage arrested)', '(sanctions oligarch)',
];

// Publisher RSS feeds (syndication feeds; each host's robots.txt is still checked at run time).
export const FEEDS = [
  ['BBC World', 'https://feeds.bbci.co.uk/news/world/rss.xml'],
  ['BBC Business', 'https://feeds.bbci.co.uk/news/business/rss.xml'],
  ['BBC Technology', 'https://feeds.bbci.co.uk/news/technology/rss.xml'],
  ['Al Jazeera', 'https://www.aljazeera.com/xml/rss/all.xml'],
  ['NPR World', 'https://feeds.npr.org/1004/rss.xml'],
  ['Guardian World', 'https://www.theguardian.com/world/rss'],
  ['NYT World', 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml'],
  ['NYT Technology', 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml'],
  ['NYT Business', 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml'],
  ['CNBC Top', 'https://www.cnbc.com/id/100003114/device/rss/rss.html'],
  ['DW', 'https://rss.dw.com/rdf/rss-en-all'],
  ['France 24', 'https://www.france24.com/en/rss'],
  ['Washington Post World', 'https://feeds.washingtonpost.com/rss/world'],
];

export const SUBREDDITS = ['worldnews', 'geopolitics', 'technology', 'news'];

// --- scoring lexicons (lower-case, matched on word boundaries) ---
export const NICHE_TERMS = {
  'corporate scandal': ['ceo', 'resign', 'resigns', 'resigned', 'ousted', 'fired', 'scandal', 'fraud', 'board', 'whistleblower', 'embezzlement', 'affair', 'misconduct', 'shareholders', 'lawsuit', 'sec', 'fine', 'fined', 'graft', 'corruption', 'bribery', 'bribe', 'smuggling', 'probe'],
  'big tech': ['nvidia', 'apple', 'google', 'alphabet', 'microsoft', 'meta', 'amazon', 'tesla', 'openai', 'tiktok', 'bytedance', 'huawei', 'tsmc', 'intel', 'samsung', 'musk', 'zuckerberg', 'altman', 'chip', 'chips', 'semiconductor', 'ai', 'antitrust'],
  'china-us tech/trade': ['china', 'chinese', 'beijing', 'xi', 'tariff', 'tariffs', 'export', 'controls', 'trade', 'taiwan', 'rare', 'earths'],
  'trump/russia': ['trump', 'putin', 'kremlin', 'russia', 'russian', 'moscow', 'white house', 'maga', 'vance'],
  'espionage': ['spy', 'spies', 'espionage', 'intelligence', 'cia', 'fbi', 'mi6', 'mss', 'leak', 'leaked', 'classified', 'agent', 'honeytrap', 'informant', 'surveillance', 'hack', 'hackers'],
  'war': ['war', 'ukraine', 'gaza', 'israel', 'iran', 'missile', 'drone', 'troops', 'offensive', 'ceasefire', 'invasion', 'strike', 'strikes', 'military', 'nato', 'army', 'navy'],
  'money/geopolitics': ['sanctions', 'oligarch', 'billionaire', 'oil', 'gas', 'dollar', 'bank', 'crypto', 'bitcoin', 'debt', 'imf', 'opec', 'gold', 'markets', 'stocks', 'shares', 'cash', 'laundering', 'stock'],
  'politics': ['election', 'president', 'congress', 'senate', 'parliament', 'minister', 'impeachment', 'coup', 'indicted', 'pardon', 'supreme court'],
};

export const CONFLICT_TERMS = ['scandal', 'resign', 'resigns', 'resigned', 'ousted', 'fired', 'accused', 'alleged', 'allegedly', 'probe', 'investigation', 'lawsuit', 'sued', 'indicted', 'charged', 'arrested', 'sanctions', 'ban', 'banned', 'feud', 'clash', 'war', 'attack', 'spy', 'espionage', 'leak', 'leaked', 'fraud', 'crackdown', 'threat', 'threatens', 'retaliation', 'tariff', 'tariffs', 'standoff', 'coup', 'affair', 'betrayal', 'cover-up', 'denies', 'denied', 'backlash', 'fallout', 'crisis', 'fine', 'fined', 'graft', 'corruption', 'smuggling', 'outage', 'cyberattack', 'pressure'];
export const TWIST_TERMS = ['but', 'after', 'despite', 'shaky', 'reversal', 'u-turn', 'secret', 'secretly', 'revealed', 'reveals', 'exclusive', 'second', 'twist', 'unravel', 'unravels', 'unexpected', 'surprise', 'hidden', 'turns out', 'actually', 'collapse', 'collapses', 'downfall', 'fall', 'toppled', 'inside', 'how', 'why'];
export const VISUAL_TERMS = ['chip', 'chips', 'factory', 'fab', 'embassy', 'border', 'missile', 'drone', 'ship', 'ships', 'tanker', 'navy', 'submarine', 'pipeline', 'server', 'data center', 'boardroom', 'courtroom', 'court', 'prison', 'palace', 'kremlin', 'white house', 'office', 'headquarters', 'port', 'strait', 'island', 'bunker', 'satellite', 'plane', 'jet', 'train', 'map', 'city', 'bank', 'vault', 'gold', 'oil', 'restaurant', 'hotel', 'summit'];
export const EVERGREEN_TERMS = ['china', 'russia', 'cia', 'kgb', 'cold war', 'taiwan', 'nvidia', 'apple', 'oil', 'nuclear', 'sanctions', 'spy', 'espionage', 'empire', 'history', 'decades', 'founder', 'founded', 'dynasty', 'oligarch', 'mafia', 'cartel', 'silicon valley', 'wall street', 'dollar', 'trade war'];
export const UNVERIFIED_TERMS = ['alleged', 'allegedly', 'reportedly', 'sources say', 'source says', 'claims', 'claimed', 'unconfirmed', 'rumor', 'rumour', 'said to', 'suspected', 'accused', 'shaky'];
export const GRAPHIC_TERMS = ['killed', 'dead', 'deaths', 'massacre', 'beheaded', 'executed', 'bodies', 'genocide', 'torture', 'rape', 'shooting', 'bombing', 'casualties', 'slaughter'];
export const OFFNICHE_TERMS = ['eurovision', 'football', 'soccer', 'nba', 'nfl', 'cricket', 'tennis', 'celebrity', 'album', 'movie', 'film festival', 'recipe', 'weather', 'horoscope', 'premier league', 'olympics', 'grammy', 'oscars', 'box office', 'game of thrones'];

// Company newsroom / press-kit pages (never "cleared": editorial use, terms must be checked).
export const PRESS_KITS = {
  nvidia: 'https://nvidianews.nvidia.com/multimedia',
  apple: 'https://www.apple.com/newsroom/',
  microsoft: 'https://news.microsoft.com/source/',
  google: 'https://blog.google/press/',
  alphabet: 'https://blog.google/press/',
  meta: 'https://about.fb.com/media-gallery/',
  amazon: 'https://press.aboutamazon.com/',
  tesla: 'https://www.tesla.com/presskit',
  openai: 'https://openai.com/news/',
  intel: 'https://newsroom.intel.com/',
  tsmc: 'https://pr.tsmc.com/english/news',
  samsung: 'https://news.samsung.com/global/',
  huawei: 'https://www.huawei.com/en/news',
};

// News agencies / wire services and broadcasters: their photos and frames are NEVER usable.
export const AGENCY_HOSTS = ['reuters.com', 'apnews.com', 'gettyimages.com', 'afp.com', 'epa.eu', 'shutterstock.com', 'alamy.com', 'youtube.com', 'cnn.com', 'bbc.co.uk', 'bbc.com', 'nbcnews.com', 'foxnews.com', 'cbsnews.com', 'abcnews.go.com'];

// Headline words that resolve to the wrong Wikipedia page on their own.
export const ALIASES = {
  Congress: 'United States Congress', Senate: 'United States Senate', 'Supreme Court': 'Supreme Court of the United States',
  Pentagon: 'The Pentagon', Fed: 'Federal Reserve', Commerce: 'United States Department of Commerce', Treasury: 'United States Department of the Treasury',
  Kremlin: 'Moscow Kremlin', Beijing: 'Beijing', Washington: 'Washington, D.C.', EU: 'European Union', NATO: 'NATO', Hamas: 'Hamas', Houthis: 'Houthis',
};
