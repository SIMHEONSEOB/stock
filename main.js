class StockRecommendation extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });

        const wrapper = document.createElement('div');
        wrapper.setAttribute('class', 'stock-card');

        const name = this.getAttribute('name');
        const ticker = this.getAttribute('ticker');
        const reason = this.getAttribute('reason');

        wrapper.innerHTML = `
            <h2>${name} (${ticker})</h2>
            <div class="stock-info">
                <p>${reason}</p>
                <div class="chart-placeholder">차트</div>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            h2 {
                color: var(--text-color);
            }
            p {
                color: var(--text-color);
            }
            .stock-card {
                border-bottom: 1px solid var(--border-color);
                padding-bottom: 20px;
                transition: border-bottom 0.2s;
            }
            .chart-placeholder {
                width: 150px;
                height: 80px;
                background-color: var(--bg-color);
                display: flex;
                justify-content: center;
                align-items: center;
                color: var(--subtle-text-color);
                transition: background-color 0.2s, color 0.2s;
            }
        `;

        shadow.appendChild(style);
        shadow.appendChild(wrapper);
    }
}

customElements.define('stock-recommendation', StockRecommendation);

const stockList = [
    {
        name: 'Apple Inc.',
        ticker: 'AAPL',
        reason: '강력한 브랜드 충성도와 지속적인 혁신을 통해 안정적인 성장을 보이고 있습니다.'
    },
    {
        name: 'Microsoft Corp.',
        ticker: 'MSFT',
        reason: '클라우드 컴퓨팅 부문의 성장과 다양한 사업 포트폴리오를 통해 높은 수익성을 자랑합니다.'
    },
    {
        name: 'Amazon.com Inc.',
        ticker: 'AMZN',
        reason: '전자상거래 시장의 지배적인 위치와 AWS 클라우드 서비스의 성장이 기대됩니다.'
    },
    {
        name: 'NVIDIA Corp.',
        ticker: 'NVDA',
        reason: 'AI 및 게이밍 그래픽 카드 시장의 선두주자로, 미래 성장 가능성이 매우 높습니다.'
    },
    {
        name: 'Tesla, Inc.',
        ticker: 'TSLA',
        reason: '전기차 시장의 혁신을 주도하며, 에너지 저장 솔루션 등 새로운 사업 영역을 개척하고 있습니다.'
    }
];

const stockListElement = document.getElementById('stock-list');

stockList.forEach(stock => {
    const stockElement = document.createElement('stock-recommendation');
    stockElement.setAttribute('name', stock.name);
    stockElement.setAttribute('ticker', stock.ticker);
    stockElement.setAttribute('reason', stock.reason);
    stockListElement.appendChild(stockElement);
});

// --- Theme Toggle Script ---
const themeToggle = document.getElementById('theme-toggle');
const htmlElement = document.documentElement;

// 1. On page load, check for saved theme in localStorage
const savedTheme = localStorage.getItem('theme') || 'light';
htmlElement.setAttribute('data-theme', savedTheme);

// 2. Add event listener to the toggle button
themeToggle.addEventListener('click', () => {
    const currentTheme = htmlElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    htmlElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme); // 3. Save the new theme preference
});
