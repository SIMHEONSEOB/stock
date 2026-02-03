// --- Global Variables ---
const ALPHA_VANTAGE_API_KEY = '1D4KMGHILXDEKMP4';
const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';
let chart = null; // To hold the chart instance
let stockData = {}; // To store fetched stock data

// --- Helper Functions (from main_old.js) ---

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateSMA(data, period) {
    const sma = [];
    for (let i = 0; i < data.length - period + 1; i++) {
        const slice = data.slice(i, i + period);
        const sum = slice.reduce((a, b) => a + b, 0);
        sma.push(sum / period);
    }
    return sma;
}

function calculateRSI(data, period) {
    const rsi = [];
    if (data.length < period) return rsi;

    let avgGain = 0;
    let avgLoss = 0;

    for (let i = 1; i <= period; i++) {
        const change = data[i] - data[i - 1];
        if (change > 0) {
            avgGain += change;
        } else {
            avgLoss += Math.abs(change);
        }
    }
    avgGain /= period;
    avgLoss /= period;

    for (let i = period + 1; i < data.length; i++) {
        const change = data[i] - data[i - 1];
        let currentGain = 0;
        let currentLoss = 0;

        if (change > 0) {
            currentGain = change;
        } else {
            currentLoss = Math.abs(change);
        }

        avgGain = (avgGain * (period - 1) + currentGain) / period;
        avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

        const rs = avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
    }
    return rsi;
}

function calculateEMA(data, period) {
    const ema = [];
    if (data.length < period) return ema;

    const multiplier = 2 / (period + 1);
    ema[period - 1] = data.slice(0, period).reduce((sum, val) => sum + val, 0) / period;

    for (let i = period; i < data.length; i++) {
        ema[i] = (data[i] - ema[i - 1]) * multiplier + ema[i - 1];
    }
    return ema.slice(period - 1);
}

function calculateMACD(data, fastPeriod, slowPeriod, signalPeriod) {
    const fastEMA = calculateEMA(data, fastPeriod);
    const slowEMA = calculateEMA(data, slowPeriod);

    const minLength = Math.min(fastEMA.length, slowEMA.length);
    const macdLine = [];
    for (let i = 0; i < minLength; i++) {
        macdLine.push(fastEMA[fastEMA.length - minLength + i] - slowEMA[slowEMA.length - minLength + i]);
    }

    const signalLine = calculateEMA(macdLine, signalPeriod);

    const histogram = [];
    const minHistogramLength = Math.min(macdLine.length, signalLine.length);
    for (let i = 0; i < minHistogramLength; i++) {
        histogram.push(macdLine[macdLine.length - minHistogramLength + i] - signalLine[signalLine.length - minHistogramLength + i]);
    }

    return { macdLine, signalLine, histogram };
}

async function fetchNewsData(ticker) {
    try {
        const url = `${ALPHA_VANTAGE_BASE_URL}?function=NEWS_SENTIMENT&tickers=${ticker}&limit=5&sort=latest&apikey=${ALPHA_VANTAGE_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data['Error Message'] || !data.feed || data.feed.length === 0) {
            console.error(`Error fetching news or no news found for ${ticker}`);
            return [];
        }
        return data.feed.slice(0, 5).map(item => ({
            title: item.title,
            url: item.url,
            source: item.source,
            time_published: item.time_published
        }));
    } catch (error) {
        console.error(`Failed to fetch news for ${ticker}:`, error);
        return [];
    }
}


// --- Main Logic ---

async function fetchStockData(ticker = 'AAPL') {
    try {
        const url = `${ALPHA_VANTAGE_BASE_URL}?function=TIME_SERIES_DAILY&symbol=${ticker}&apikey=${ALPHA_VANTAGE_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data['Error Message'] || !data['Time Series (Daily)']) {
            console.error(`Error fetching data for ${ticker}`);
            return;
        }

        const timeSeries = data['Time Series (Daily)'];
        const dates = Object.keys(timeSeries).sort();
        const prices = dates.map(date => parseFloat(timeSeries[date]['4. close']));

        if (prices.length < 30) {
            console.error('Not enough data to calculate indicators.');
            return;
        }
        
        stockData.dates = dates;
        stockData.prices = prices;

        const latestPrice = prices[prices.length - 1].toFixed(2);
        
        const sma20 = calculateSMA(prices, 20);
        const latestSMA20 = sma20[sma20.length - 1].toFixed(2);

        const rsi14 = calculateRSI(prices, 14);
        const latestRSI14 = rsi14[rsi14.length - 1].toFixed(2);

        const macd = calculateMACD(prices, 12, 26, 9);
        const latestMACDLine = macd.macdLine[macd.macdLine.length - 1].toFixed(2);
        const latestSignalLine = macd.signalLine[macd.signalLine.length - 1].toFixed(2);
        const latestHistogram = macd.histogram[macd.histogram.length - 1].toFixed(2);

        let recommendation = '관망';
        let reason = '지표를 분석 중입니다.';

        const rsiVal = parseFloat(latestRSI14);
        const macdVal = parseFloat(latestMACDLine);
        const signalVal = parseFloat(latestSignalLine);
        const prevMACDLine = macd.macdLine[macd.macdLine.length - 2];
        const prevSignalLine = macd.signalLine[macd.signalLine.length - 2];

        if (rsiVal < 30 && macdVal > signalVal && prevMACDLine <= prevSignalLine) {
            recommendation = '매수 추천';
            reason = `RSI(14) ${rsiVal}로 과매도 구간이며, MACD선이 시그널선을 상향 돌파했습니다.`;
        } else if (rsiVal > 70 && macdVal < signalVal && prevMACDLine >= prevSignalLine) {
            recommendation = '매도 추천';
            reason = `RSI(14) ${rsiVal}로 과매수 구간이며, MACD선이 시그널선을 하향 돌파했습니다.`;
        } else if (latestPrice > latestSMA20) {
            recommendation = '유지 (상승 추세)';
            reason = `현재 가격이 SMA(20) 위에 있습니다.`;
        } else if (latestPrice < latestSMA20) {
            recommendation = '유지 (하락 추세)';
            reason = `현재 가격이 SMA(20) 아래에 있습니다.`;
        }

        // Update DOM
        document.getElementById('stock-name').textContent = `${data['Meta Data']['2. Symbol']} (${ticker})`;
        document.getElementById('status').textContent = recommendation;
        document.getElementById('price').firstChild.nodeValue = `$${latestPrice}`;
        document.getElementById('sma-value').textContent = latestSMA20;
        document.getElementById('rsi-value').textContent = latestRSI14;
        document.getElementById('macd-value').textContent = latestMACDLine;
        document.getElementById('signal-value').textContent = latestSignalLine;
        document.getElementById('histogram-value').textContent = latestHistogram;
        document.getElementById('rec-value').textContent = recommendation.split(' ')[0];
        document.getElementById('ai-reason').textContent = reason;

        // Fetch and render news
        const newsArticles = await fetchNewsData(ticker);
        renderNews(newsArticles);

    } catch (error) {
        console.error('Failed to fetch and render stock data:', error);
    }
}

function renderNews(articles) {
    const newsSection = document.getElementById('news-section');
    if (!articles || articles.length === 0) {
        newsSection.innerHTML = `
            <h3>관련 뉴스</h3>
            <div class="no-news">
                 <div class="search-icon"></div>
                <p>관련 뉴스를 찾을 수 없습니다.</p>
            </div>
        `;
        return;
    }

    const newsList = articles.map(article => `
        <div class="news-article">
            <a href="${article.url}" target="_blank">${article.title}</a>
            <span>(${article.source} - ${new Date(article.time_published).toLocaleDateString()})</span>
        </div>
    `).join('');

    newsSection.innerHTML = `<h3>관련 뉴스</h3><div class="news-list">${newsList}</div>`;
}


// --- Chart Logic ---

function renderChart() {
    const modal = document.getElementById('chart-modal');
    const ctx = document.getElementById('stock-chart').getContext('2d');

    if (chart) {
        chart.destroy();
    }

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: stockData.dates.slice(-30),
            datasets: [{
                label: '종가',
                data: stockData.prices.slice(-30),
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 2,
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { ticks: { color: '#c9d1d9' } },
                y: { ticks: { color: '#c9d1d9' } }
            },
            plugins: {
                legend: { labels: { color: '#c9d1d9' } }
            }
        }
    });
    modal.style.display = 'block';
}

// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    fetchStockData(); // Fetch data on page load

    const chartBtn = document.getElementById('chart-btn');
    const modal = document.getElementById('chart-modal');
    const closeBtn = document.querySelector('.close-button');

    chartBtn.addEventListener('click', () => {
        if (stockData.prices && stockData.dates) {
            renderChart();
        } else {
            alert('차트 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
        }
    });

    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    });
});
