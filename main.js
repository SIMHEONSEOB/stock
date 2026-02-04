// --- Global Variables ---
const ALPHA_VANTAGE_API_KEY = '1D4KMGHILXDEKMP4'; // Replace with your actual Alpha Vantage API Key
const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';
// No global chart instance needed now as charts are per custom element
// No global stockData needed as each stock's data is passed to its custom element

// --- Helper Functions ---

/**
 * Introduces a delay.
 * @param {number} ms - Milliseconds to sleep.
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculates Simple Moving Average (SMA).
 * @param {Array<number>} data - Array of closing prices.
 * @param {number} period - The period for SMA calculation.
 * @returns {Array<number>} - Array of SMA values.
 */
function calculateSMA(data, period) {
    const sma = [];
    for (let i = 0; i < data.length - period + 1; i++) {
        const slice = data.slice(i, i + period);
        const sum = slice.reduce((a, b) => a + b, 0);
        sma.push(sum / period);
    }
    return sma;
}

/**
 * Calculates Relative Strength Index (RSI).
 * @param {Array<number>} data - Array of closing prices.
 * @param {number} period - The period for RSI calculation.
 * @returns {Array<number>} - Array of RSI values.
 */
function calculateRSI(data, period) {
    const rsi = [];
    if (data.length < period) return rsi;

    let avgGain = 0;
    let avgLoss = 0;

    // Calculate initial average gain and loss
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

/**
 * Calculates Exponential Moving Average (EMA). Helper for MACD.
 * @param {Array<number>} data - Array of closing prices.
 * @param {number} period - The period for EMA calculation.
 * @returns {Array<number>} - Array of EMA values.
 */
function calculateEMA(data, period) {
    const ema = [];
    if (data.length < period) return ema;

    const multiplier = 2 / (period + 1);
    ema[period - 1] = data.slice(0, period).reduce((sum, val) => sum + val, 0) / period; // Initial SMA

    for (let i = period; i < data.length; i++) {
        ema[i] = (data[i] - ema[i - 1]) * multiplier + ema[i - 1];
    }
    return ema.slice(period - 1);
}

/**
 * Calculates Moving Average Convergence Divergence (MACD).
 * @param {Array<number>} data - Array of closing prices.
 * @param {number} fastPeriod - The period for the fast EMA (e.g., 12).
 * @param {number} slowPeriod - The period for the slow EMA (e.g., 26).
 * @param {number} signalPeriod - The period for the signal line EMA (e.g., 9).
 * @returns {{macdLine: Array<number>, signalLine: Array<number>, histogram: Array<number>}} - MACD components.
 */
function calculateMACD(data, fastPeriod, slowPeriod, signalPeriod) {
    const fastEMA = calculateEMA(data, fastPeriod);
    const slowEMA = calculateEMA(data, slowPeriod);

    // Ensure EMAs are of the same length by trimming the longer one
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

// --- StockRecommendation Custom Element ---
class StockRecommendation extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' }); // Attach shadow DOM in constructor
        this.chart = null; // To hold the Chart.js instance
    }

    // Attributes to observe
    static get observedAttributes() {
        return ['name', 'ticker', 'reason', 'latest-price', 'sma20', 'rsi14', 'macd-line', 'signal-line', 'histogram', 'recommendation', 'news', 'prices', 'dates'];
    }

    connectedCallback() {
        // Called when the element is inserted into the DOM
        this.render();
        // Wait for the chart to be rendered to call renderChart
        if (this.isConnected) { // Ensure element is still in DOM
             // Using setTimeout to ensure the canvas is rendered and available in shadow DOM
            setTimeout(() => {
                this.renderChart();
            }, 0);
        }
    }

    attributeChangedCallback(name, oldValue, newValue) {
        // Called when an observed attribute changes
        if (oldValue !== newValue) {
            this.render();
            if (this.isConnected) { // Ensure element is still in DOM
                setTimeout(() => {
                    this.renderChart();
                }, 0);
            }
        }
    }

    render() {
        // Get attribute values at render time
        const name = this.getAttribute('name');
        const ticker = this.getAttribute('ticker');
        const reason = this.getAttribute('reason');
        const latestPrice = this.getAttribute('latest-price');
        const sma20 = this.getAttribute('sma20');
        const rsi14 = this.getAttribute('rsi14');
        const macdLine = this.getAttribute('macd-line');
        const signalLine = this.getAttribute('signal-line');
        const histogram = this.getAttribute('histogram');
        const recommendation = this.getAttribute('recommendation');
        const newsString = this.getAttribute('news');
        let news = [];
        if (newsString && newsString !== 'undefined') {
            try {
                news = JSON.parse(newsString);
            } catch (e) {
                console.error("Error parsing news data:", e, "newsString was:", newsString);
            }
        }

        // Clear existing content
        this.shadowRoot.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.setAttribute('class', 'stock-card');

        let newsHtml = '';
        if (news.length > 0) {
            newsHtml = `
                <h3>최신 뉴스</h3>
                <ul class="news-list">
                    ${news.map(article => `
                        <li>
                            <a href="${article.url}" target="_blank">${article.title}</a>
                            <span class="news-source">(${article.source} - ${new Date(article.time_published).toLocaleDateString()})</span>
                        </li>
                    `).join('')}
                </ul>
            `;
        } else {
            newsHtml = '<p>관련 뉴스를 찾을 수 없습니다.</p>';
        }

        wrapper.innerHTML = `
            <h2>${name} (${ticker})</h2>
            <div class="stock-info">
                <p><strong>최신 가격:</strong> $${latestPrice}</p>
                <p><strong>SMA(20):</strong> ${sma20}</p>
                <p><strong>RSI(14):</strong> ${rsi14}</p>
                <p><strong>MACD 선:</strong> ${macdLine}</p>
                <p><strong>시그널 선:</strong> ${signalLine}</p>
                <p><strong>히스토그램:</strong> ${histogram}</p>
                <p><strong>추천:</strong> ${recommendation}</p>
                <p><strong>사유:</strong> ${reason}</p>
            </div>
            <div class="chart-container" style="height:200px; width:100%;"><canvas class="stock-chart"></canvas></div>
            <div class="stock-news">
                ${newsHtml}
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            :host {
                --text-color: #1a1a1a;
                --subtle-text-color: #8c8c8c;
                --link-color: #0052ff;
                --border-color: #eef0f4;
            }
            @media (prefers-color-scheme: dark) {
                :host {
                    --text-color: #f7f9fb;
                    --subtle-text-color: #b0b0b0;
                    --link-color: #6495ED; /* Lighter blue for dark mode */
                    --border-color: #333d4e;
                }
            }
            .stock-card {
                background-color: var(--background-color, #f7f9fb); /* Use a CSS variable for background */
                border-radius: 16px;
                padding: 24px;
                margin-bottom: 24px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.05);
                color: var(--text-color);
            }
            @media (prefers-color-scheme: dark) {
                .stock-card {
                    background-color: var(--background-color-dark, #1f2937); /* Dark background */
                }
            }

            h2 {
                color: var(--text-color);
                font-size: 24px;
                margin-top: 0;
            }
            h3 {
                color: var(--text-color);
                font-size: 18px;
                margin-top: 20px;
                border-top: 1px solid var(--border-color);
                padding-top: 15px;
            }
            p {
                color: var(--text-color);
                margin: 5px 0;
            }
            .stock-info {
                margin-bottom: 20px;
            }
            .news-list {
                list-style: none;
                padding: 0;
            }
            .news-list li {
                margin-bottom: 8px;
            }
            .news-list a {
                color: var(--link-color);
                text-decoration: none;
                font-weight: 500;
            }
            .news-list a:hover {
                text-decoration: underline;
            }
            .news-source {
                font-size: 0.9em;
                color: var(--subtle-text-color);
                display: block;
                margin-top: 2px;
            }
            .chart-container {
                margin-top: 20px;
            }
        `;

        this.shadowRoot.appendChild(style);
        this.shadowRoot.appendChild(wrapper);
    }

    renderChart() {
        const pricesString = this.getAttribute('prices');
        const datesString = this.getAttribute('dates');

        if (!pricesString || !datesString) {
            console.warn("Chart data (prices or dates) not available.");
            return;
        }

        let prices;
        let dates;
        try {
            prices = JSON.parse(pricesString);
            dates = JSON.parse(datesString);
        } catch (e) {
            console.error("Error parsing prices or dates for chart:", e);
            return;
        }


        if (!Array.isArray(prices) || !Array.isArray(dates) || prices.length === 0 || dates.length === 0) {
            console.warn("Chart data (parsed prices or dates) is empty or invalid.");
            return;
        }

        const ctx = this.shadowRoot.querySelector('.stock-chart');
        if (!ctx) {
            console.error("Canvas element for chart not found in shadow DOM.");
            return;
        }
        
        // Destroy existing chart instance if any
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        
        // Limit to last 30 days for chart readability
        const chartLabels = dates.slice(-30).map(date => {
            const d = new Date(date);
            return `${d.getMonth() + 1}/${d.getDate()}`; // M/D format
        });
        const chartData = prices.slice(-30);

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: '종가',
                    data: chartData,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1,
                    fill: false,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: '날짜',
                            color: 'var(--subtle-text-color)'
                        },
                        ticks: {
                            color: 'var(--subtle-text-color)'
                        },
                        grid: {
                            color: 'var(--border-color)'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: '가격 (USD)',
                            color: 'var(--subtle-text-color)'
                        },
                        ticks: {
                            color: 'var(--subtle-text-color)'
                        },
                        grid: {
                            color: 'var(--border-color)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: 'var(--text-color)'
                        }
                    }
                }
            }
        });
    }
}

customElements.define('stock-recommendation', StockRecommendation);

// --- Main Data Fetching and UI Update Logic ---
const targetTickers = ['AAPL', 'MSFT', 'GOOGL', 'JNJ', 'PG', 'KO']; // Blue-chip stocks
const stockListElement = document.getElementById('stock-list');

async function fetchNewsData(ticker) {
    try {
        const url = `${ALPHA_VANTAGE_BASE_URL}?function=NEWS_SENTIMENT&tickers=${ticker}&limit=5&sort=latest&apikey=${ALPHA_VANTAGE_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data['Error Message'] || !data.feed || data.feed.length === 0) {
            console.warn(`Error fetching news or no news found for ${ticker}:`, data['Error Message'] || 'No feed');
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

async function fetchAndRecommendStocks() {
    stockListElement.innerHTML = '<div class="loading-spinner"></div><p>주식 데이터를 불러오는 중입니다...</p>'; // Loading indicator
    stockListElement.style.textAlign = 'center';
    stockListElement.style.padding = '20px';
    stockListElement.style.color = '#8c8c8c';


    const recommendedStocks = [];

    for (const ticker of targetTickers) {
        try {
            const url = `${ALPHA_VANTAGE_BASE_URL}?function=TIME_SERIES_DAILY&symbol=${ticker}&apikey=${ALPHA_VANTAGE_API_KEY}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data['Error Message']) {
                console.error(`Error fetching data for ${ticker}: ${data['Error Message']}`);
                recommendedStocks.push({
                    ticker: ticker,
                    name: ticker,
                    latestPrice: 'N/A', sma20: 'N/A', rsi14: 'N/A', macdLine: 'N/A', signalLine: 'N/A', histogram: 'N/A',
                    recommendation: '데이터 로드 실패',
                    reason: `데이터를 불러올 수 없습니다: ${data['Error Message']}`
                });
                await sleep(13000); // Wait even on error to prevent rapid re-attempts
                continue;
            }
            if (!data['Time Series (Daily)']) {
                console.warn(`No daily time series data for ${ticker}. Possibly invalid ticker or API limit reached.`);
                 recommendedStocks.push({
                    ticker: ticker,
                    name: ticker,
                    latestPrice: 'N/A', sma20: 'N/A', rsi14: 'N/A', macdLine: 'N/A', signalLine: 'N/A', histogram: 'N/A',
                    recommendation: '데이터 없음',
                    reason: `일별 시계열 데이터가 없습니다. (API 한도 도달 또는 잘못된 티커)`
                });
                await sleep(13000);
                continue;
            }

            const timeSeries = data['Time Series (Daily)'];
            const dates = Object.keys(timeSeries).sort(); // Sort by date ascending
            const prices = dates.map(date => parseFloat(timeSeries[date]['4. close']));
            const companyName = data['Meta Data']['2. Symbol'] || ticker;


            if (prices.length === 0) {
                recommendedStocks.push({
                    ticker: ticker, name: companyName,
                    latestPrice: 'N/A', sma20: 'N/A', rsi14: 'N/A', macdLine: 'N/A', signalLine: 'N/A', histogram: 'N/A',
                    recommendation: '데이터 없음',
                    reason: `데이터를 불러올 수 없습니다. (${ticker})`
                });
                await sleep(13000);
                continue;
            }

            const latestPrice = prices[prices.length - 1];
            
            // Fetch news data concurrently if possible, or sequentially if API demands
            const newsArticles = await fetchNewsData(ticker); // Fetch news
            await sleep(1000); // Small delay after news fetch

            let latestSMA20 = 'N/A';
            let latestRSI14 = 'N/A';
            let latestMACDLine = 'N/A';
            let latestSignalLine = 'N/A';
            let latestHistogram = 'N/A';

            let recommendation = '데이터 부족';
            let reason = `지표 계산에 필요한 데이터 부족 (${prices.length}개)`;

            if (prices.length >= 30) { // Enough data for all indicators
                const sma20 = calculateSMA(prices, 20);
                latestSMA20 = (sma20.length > 0 && isFinite(sma20[sma20.length - 1])) ? sma20[sma20.length - 1].toFixed(2) : 'N/A';

                const rsi14 = calculateRSI(prices, 14);
                latestRSI14 = (rsi14.length > 0 && isFinite(rsi14[rsi14.length - 1])) ? rsi14[rsi14.length - 1].toFixed(2) : 'N/A';

                const macd = calculateMACD(prices, 12, 26, 9);
                latestMACDLine = (macd.macdLine.length > 0 && isFinite(macd.macdLine[macd.macdLine.length - 1])) ? macd.macdLine[macd.macdLine.length - 1].toFixed(2) : 'N/A';
                latestSignalLine = (macd.signalLine.length > 0 && isFinite(macd.signalLine[macd.signalLine.length - 1])) ? macd.signalLine[macd.signalLine.length - 1].toFixed(2) : 'N/A';
                latestHistogram = (macd.histogram.length > 0 && isFinite(macd.histogram[macd.histogram.length - 1])) ? macd.histogram[macd.histogram.length - 1].toFixed(2) : 'N/A';

                // Recommendation Logic based on technical indicators
                recommendation = '관망';
                reason = '추가 지표 분석 중...';

                if (latestRSI14 !== 'N/A' && latestMACDLine !== 'N/A' && latestSignalLine !== 'N/A' &&
                    !isNaN(parseFloat(latestRSI14)) && !isNaN(parseFloat(latestMACDLine)) && !isNaN(parseFloat(latestSignalLine))) {

                    const rsiVal = parseFloat(latestRSI14);
                    const macdVal = parseFloat(latestMACDLine);
                    const signalVal = parseFloat(latestSignalLine);

                    // Check for MACD crossover (buy signal)
                    const macdBuySignal = (macdVal > signalVal && macd.macdLine.length > 1 && macd.signalLine.length > 1 && macd.macdLine[macd.macdLine.length - 2] <= macd.signalLine[macd.signalLine.length - 2]);
                    // Check for MACD crossover (sell signal)
                    const macdSellSignal = (macdVal < signalVal && macd.macdLine.length > 1 && macd.signalLine.length > 1 && macd.macdLine[macd.macdLine.length - 2] >= macd.signalLine[macd.signalLine.length - 2]);

                    if (rsiVal < 30 && macdBuySignal) {
                        recommendation = '강력 매수';
                        reason = `RSI(${rsiVal.toFixed(2)}) 과매도 구간 + MACD 골든 크로스 발생.`;
                    } else if (rsiVal > 70 && macdSellSignal) {
                        recommendation = '강력 매도';
                        reason = `RSI(${rsiVal.toFixed(2)}) 과매수 구간 + MACD 데드 크로스 발생.`;
                    } else if (macdBuySignal) {
                        recommendation = '매수';
                        reason = `MACD 골든 크로스 발생.`;
                    } else if (macdSellSignal) {
                        recommendation = '매도';
                        reason = `MACD 데드 크로스 발생.`;
                    } else if (latestPrice !== 'N/A' && latestSMA20 !== 'N/A' && !isNaN(parseFloat(latestPrice)) && !isNaN(parseFloat(latestSMA20))) {
                        const priceVal = parseFloat(latestPrice);
                        const smaVal = parseFloat(latestSMA20);
                        if (priceVal > smaVal) {
                            recommendation = '유지 (상승 추세)';
                            reason = `현재 가격($${priceVal.toFixed(2)})이 SMA(20)($${smaVal.toFixed(2)}) 위에 있습니다.`;
                        } else if (priceVal < smaVal) {
                            recommendation = '유지 (하락 추세)';
                            reason = `현재 가격($${priceVal.toFixed(2)})이 SMA(20)($${smaVal.toFixed(2)}) 아래에 있습니다.`;
                        } else {
                            reason = '특별한 신호 없음.';
                        }
                    } else {
                        reason = '특별한 신호 없음.';
                    }
                } else {
                    reason = '지표 계산을 위한 충분한 데이터 부족 또는 N/A 값.';
                }
            }

            recommendedStocks.push({
                ticker: ticker,
                name: companyName,
                latestPrice: latestPrice.toFixed(2),
                sma20: latestSMA20,
                rsi14: latestRSI14,
                macdLine: latestMACDLine,
                signalLine: latestSignalLine,
                histogram: latestHistogram,
                recommendation: recommendation,
                reason: reason,
                news: newsArticles,
                prices: prices,
                dates: dates
            });

            await sleep(13000); // 13 seconds delay to respect Alpha Vantage API rate limits (5 calls per minute)

        } catch (error) {
            console.error(`Failed to fetch data for ${ticker}:`, error);
            recommendedStocks.push({
                ticker: ticker,
                name: ticker,
                latestPrice: 'N/A', sma20: 'N/A', rsi14: 'N/A', macdLine: 'N/A', signalLine: 'N/A', histogram: 'N/A',
                recommendation: '오류 발생',
                reason: `데이터를 불러오는 중 오류가 발생했습니다: ${error.message}`
            });
            await sleep(13000);
        }
    }

    stockListElement.innerHTML = ''; // Clear loading indicator
    stockListElement.style.textAlign = 'left';
    stockListElement.style.padding = '0';


    if (recommendedStocks.length === 0) {
        stockListElement.innerHTML = '<p>표시할 주식 추천이 없습니다.</p>';
        return;
    }

    // Sort by recommendation strength (e.g., "강력 매수" first)
    recommendedStocks.sort((a, b) => {
        const order = { '강력 매수': 1, '매수': 2, '유지 (상승 추세)': 3, '관망': 4, '유지 (하락 추세)': 5, '매도': 6, '강력 매도': 7, '데이터 부족': 8, '데이터 로드 실패': 9, '데이터 없음': 10, '오류 발생': 11 };
        return (order[a.recommendation] || 99) - (order[b.recommendation] || 99);
    });

    recommendedStocks.forEach(stock => {
        const stockElement = document.createElement('stock-recommendation');
        stockElement.setAttribute('name', stock.name);
        stockElement.setAttribute('ticker', stock.ticker);
        stockElement.setAttribute('reason', stock.reason);
        stockElement.setAttribute('latest-price', stock.latestPrice);
        stockElement.setAttribute('sma20', stock.sma20);
        stockElement.setAttribute('rsi14', stock.rsi14);
        stockElement.setAttribute('macd-line', stock.macdLine);
        stockElement.setAttribute('signal-line', stock.signalLine);
        stockElement.setAttribute('histogram', stock.histogram);
        stockElement.setAttribute('recommendation', stock.recommendation);
        stockElement.setAttribute('news', JSON.stringify(stock.news));
        stockElement.setAttribute('prices', JSON.stringify(stock.prices));
        stockElement.setAttribute('dates', JSON.stringify(stock.dates));
        stockListElement.appendChild(stockElement);
    });
}

// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    fetchAndRecommendStocks(); // Initial call to fetch and recommend stocks

    // Original chart and news modal logic (now simplified as these are managed by custom elements)
    // The chart and news modals were for single stock view, which is now replaced by multiple stock cards.
    // However, the overall page might still have these elements, so we need to ensure they don't break.

    // Chart Modal Logic (removed direct chart rendering, will be handled by custom elements)
    const chartActionBtn = document.getElementById('chart-action-btn');
    if (chartActionBtn) {
        chartActionBtn.addEventListener('click', () => {
            alert('개별 주식 차트는 해당 카드에서 확인해주세요.'); // Inform user
        });
    }

    // News Modal Logic (removed direct news rendering, will be handled by custom elements)
    const newsActionBtn = document.getElementById('news-action-btn');
    const newsModal = document.getElementById('news-modal');
    const newsCloseBtn = newsModal ? newsModal.querySelector('.close-button') : null;

    if (newsActionBtn) {
        newsActionBtn.addEventListener('click', () => {
             alert('개별 주식 뉴스는 해당 카드에서 확인해주세요.'); // Inform user
        });
    }
     if (newsCloseBtn) {
        newsCloseBtn.addEventListener('click', () => {
            newsModal.classList.remove('show');
        });
    }
    if (newsModal) {
        window.addEventListener('click', (event) => {
            if (event.target == newsModal) {
                newsModal.classList.remove('show');
            }
        });
    }

});