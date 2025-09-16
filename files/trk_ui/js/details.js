let currentPage = 1; // 当前页码
const pageSize = 15; // 每页大小
let cachedData = null; // 缓存数据用于排序
let currentSort = { column: '', order: 'asc' }; // 当前排序列和顺序

function getQueryParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        domain: params.get('domain'),
        site: params.get('sites'),
        range: params.get('range'),
        filePath: params.get('file_path') || '2.csv',
        groupBy: params.getAll('group_by').length > 0 ? params.getAll('group_by') : ['COUNTRY_NAME'],
    };
}

const order = {
    init(param) {
        const that = this;
        const table = param.el;
        if (!table) return;
    
        // 获取tbody节点
        const tbody = table.getElementsByTagName('tbody')[0];
        // 获取所有th节点，并将其转为数组
        const ths = Array.from(table.getElementsByTagName('th'));
        // 获取所有tr节点，并将其转为数组
        const trs = Array.from(tbody.getElementsByTagName('tr'));
        const list = this.getBodyList(trs);
        
        // 设第一行是Total行
        const totalRow = list[0]; // 获取Total行
        const dataRows = list.slice(1); // 获取数据行，排除Total行
        
        ths.forEach((th, index) => {
            // 为th绑定点击事件
            th.addEventListener('click', () => {
                // 判断当前数据是否为升序
                const isAsc = this.isAsc(dataRows, index);
                // 排除"Total"列的索引（设为第一列）
                if (index !== 0) { // 只对非"Total"列进行排序
                    dataRows.sort((a, b) => isAsc ? b.value[index] - a.value[index] : a.value[index] - b.value[index]);
                    // 清空tbody并重新插入Total行和排序后的数据行
                    tbody.innerHTML = ''; // 清空tbody
                    tbody.appendChild(totalRow.tr); // 先插入Total行
                    dataRows.forEach((tr) => {
                        tbody.appendChild(tr.tr);
                    });
                }
            });
        });
    },
    
    getBodyList(trs) {
        return trs.map(tr => {
            // 获取tr的所有td节点，并将其转为数组
            const tds = Array.from(tr.getElementsByTagName('td'));
            // 将td的内容转为数字，去掉$和%和单位
            const val = tds.map(td => {
                // 使用正则表达式去掉$和%符号，并转换为数字
                const text = td.innerHTML.replace(/[$%]/g, '').trim();
                return this.convertToNumber(text);
            });
            return { tr: tr, value: val };
        });
    },
    
    convertToNumber(text) {
        // 检查文本中是否包含单位，并进行转换
        if (text.endsWith('k')) {
            return parseFloat(text.slice(0, -1)) * 1000; // k -> x 1000
        } else if (text.endsWith('M')) {
            return parseFloat(text.slice(0, -1)) * 1000000; // M -> x 1000000
        } else if (text.endsWith('B')) {
            return parseFloat(text.slice(0, -1)) * 1000000000; // B -> x 1000000000
        }
        return parseFloat(text); // 返回原始数字
    },
    
    isAsc(list, index) {
        // 判断list的value中第index个值是否为升序排列
        let arr = list.map(tr => tr.value[index]);
        let flag = true;
        for (let i = 0; i < arr.length - 1; i++) {
            if (arr[i] > arr[i + 1]) {
                flag = false;
                break;
            }
        }
        return flag;
    }
};
const order2 = {
    init(param) {
        const that = this;
        const table = param.el;
        if (!table) return;
    
        // 获取tbody节点
        const tbody = table.getElementsByTagName('tbody')[0];
        // 获取所有th节点，并将其转为数组
        const ths = Array.from(table.getElementsByTagName('th'));
        // 获取所有tr节点，并将其转为数组
        const trs = Array.from(tbody.getElementsByTagName('tr'));
        const list = this.getBodyList(trs);
        
        // 设第一行是Total行
        const totalRow = list[0]; // 获取Total行
        const dataRows = list.slice(1); // 获取数据行，排除Total行
        
        ths.forEach((th, index) => {
            // 为th绑定点击事件
            th.addEventListener('click', () => {
                // 判断当前数据是否为升序
                const isAsc = this.isAsc(dataRows, index);
                // 排除"Total"列的索引（设为第一列）
                if (index !== 0) { // 只对非"Total"列进行排序
                    dataRows.sort((a, b) => isAsc ? b.value[index] - a.value[index] : a.value[index] - b.value[index]);
                    // 清空tbody并重新插入Total行和排序后的数据行
                    tbody.innerHTML = ''; // 清空tbody
                    tbody.appendChild(totalRow.tr); // 先插入Total行
                    dataRows.forEach((tr) => {
                        tbody.appendChild(tr.tr);
                    });
                }
            });
        });
    },
    
    getBodyList(trs) {
        return trs.map(tr => {
            // 获取tr的所有td节点，并将其转为数组
            const tds = Array.from(tr.getElementsByTagName('td'));
            // 将td的内容转为数字，去掉$和%和单位
            const val = tds.map(td => {
                // 使用正则表达式去掉$和%符号，并转换为数字
                const text = td.innerHTML.replace(/[$%]/g, '').trim();
                return this.convertToNumber(text);
            });
            return { tr: tr, value: val };
        });
    },
    
    convertToNumber(text) {
        // 检查文本中是否包含单位，并进行转换
        if (text.endsWith('k')) {
            return parseFloat(text.slice(0, -1)) * 1000; // k -> x 1000
        } else if (text.endsWith('M')) {
            return parseFloat(text.slice(0, -1)) * 1000000; // M -> x 1000000
        } else if (text.endsWith('B')) {
            return parseFloat(text.slice(0, -1)) * 1000000000; // B -> x 1000000000
        }
        return parseFloat(text); // 返回原始数字
    },
    
    isAsc(list, index) {
        // 判断list的value中第index个值是否为升序排列
        let arr = list.map(tr => tr.value[index]);
        let flag = true;
        for (let i = 0; i < arr.length - 1; i++) {
            if (arr[i] > arr[i + 1]) {
                flag = false;
                break;
            }
        }
        return flag;
    }
};
const order3 = {
    init(param) {
        const that = this;
        const table = param.el;
        if (!table) return;
    
        // 获取tbody节点
        const tbody = table.getElementsByTagName('tbody')[0];
        // 获取所有th节点，并将其转为数组
        const ths = Array.from(table.getElementsByTagName('th'));
        // 获取所有tr节点，并将其转为数组
        const trs = Array.from(tbody.getElementsByTagName('tr'));
        const list = this.getBodyList(trs);
        
        // 设第一行是Total行
        const totalRow = list[0]; // 获取Total行
        const dataRows = list.slice(1); // 获取数据行，排除Total行
        
        ths.forEach((th, index) => {
            // 为th绑定点击事件
            th.addEventListener('click', () => {
                // 判断当前数据是否为升序
                const isAsc = this.isAsc(dataRows, index);
                // 排除"Total"列的索引（设为第一列）
                if (index !== 0) { // 只对非"Total"列进行排序
                    dataRows.sort((a, b) => isAsc ? b.value[index] - a.value[index] : a.value[index] - b.value[index]);
                    // 清空tbody并重新插入Total行和排序后的数据行
                    tbody.innerHTML = ''; // 清空tbody
                    tbody.appendChild(totalRow.tr); // 先插入Total行
                    dataRows.forEach((tr) => {
                        tbody.appendChild(tr.tr);
                    });
                }
            });
        });
    },
    
    getBodyList(trs) {
        return trs.map(tr => {
            // 获取tr的所有td节点，并将其转为数组
            const tds = Array.from(tr.getElementsByTagName('td'));
            // 将td的内容转为数字，去掉$和%和单位
            const val = tds.map(td => {
                // 使用正则表达式去掉$和%符号，并转换为数字
                const text = td.innerHTML.replace(/[$%]/g, '').trim();
                return this.convertToNumber(text);
            });
            return { tr: tr, value: val };
        });
    },
    
    convertToNumber(text) {
        // 检查文本中是否包含单位，并进行转换
        if (text.endsWith('k')) {
            return parseFloat(text.slice(0, -1)) * 1000; // k -> x 1000
        } else if (text.endsWith('M')) {
            return parseFloat(text.slice(0, -1)) * 1000000; // M -> x 1000000
        } else if (text.endsWith('B')) {
            return parseFloat(text.slice(0, -1)) * 1000000000; // B -> x 1000000000
        }
        return parseFloat(text); // 返回原始数字
    },
    
    isAsc(list, index) {
        // 判断list的value中第index个值是否为升序排列
        let arr = list.map(tr => tr.value[index]);
        let flag = true;
        for (let i = 0; i < arr.length - 1; i++) {
            if (arr[i] > arr[i + 1]) {
                flag = false;
                break;
            }
        }
        return flag;
    }
};

// 初始化排序
order.init({
    // 请获取class=container下的table的节点
    el: document.getElementsByClassName('domain-table')[0].getElementsByTagName('table')[0],
});
order2.init({
    el: document.getElementsByClassName('domain-table2')[0].getElementsByTagName('table')[0],
});
order3.init({
    el: document.getElementsByClassName('domain-table3')[0].getElementsByTagName('table')[0],
});

$('.table_h').on('click', function() {
    if ($(this).hasClass('active')) {
        $(this).removeClass('active');
    } else {
        $('.table_h').removeClass('active');
        $(this).addClass('active');
    }
});

let selectedDates = [];

const datePicker = flatpickr("#dateRangePicker", {
    mode: "range",
    dateFormat: "Y-m-d", 
    maxDate: "today", 
    onChange: function(selectedDatesArray) {
        selectedDates = selectedDatesArray; 
    }
});

$("#confirmBtn").on('click', function() {
    let formattedDates = [];
    
    for (let i = 0; i < selectedDates.length; i++) {
        const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
        const formattedDate = new Intl.DateTimeFormat('en-CA', options).format(selectedDates[i]);
        formattedDates.push(formattedDate);
    }
    if(formattedDates.length == 0){
        return;
    }
    let result = formattedDates.length > 1 ? formattedDates.join(' - ') : formattedDates[0];

    const currentUrl = new URL(window.location.href); // 使用URL对象来处理URL
    currentUrl.searchParams.set('range', result); // 设置或更新range参数
    window.location.href = currentUrl.toString(); // 跳转到更新后的URL
});
var rangeChart = '';
renderChart(rangeChart);
async function renderChart(range) {
    // 使用数据替代API调用
    const mockData = {
        data: [
            { day: '2025-01-09', total_revenue: 1250.50, total_ecpm: 2.45, total_clicks: 1250, total_impressions: 51000 },
            { day: '2025-01-10', total_revenue: 1380.75, total_ecpm: 2.68, total_clicks: 1380, total_impressions: 51500 },
            { day: '2025-01-11', total_revenue: 1120.30, total_ecpm: 2.18, total_clicks: 1120, total_impressions: 51400 },
            { day: '2025-01-12', total_revenue: 1450.90, total_ecpm: 2.82, total_clicks: 1450, total_impressions: 51450 },
            { day: '2025-01-13', total_revenue: 1320.60, total_ecpm: 2.57, total_clicks: 1320, total_impressions: 51420 },
            { day: '2025-01-14', total_revenue: 1580.25, total_ecpm: 3.07, total_clicks: 1580, total_impressions: 51500 },
            { day: '2025-01-15', total_revenue: 1290.80, total_ecpm: 2.51, total_clicks: 1290, total_impressions: 51400 }
        ]
    };
    
    $(".today_cpc").html();
    // Extracting labels and series data from the mock data
    const labels = mockData.data.map(item => item.day);
    const totalRevenueData = mockData.data.map(item => item.total_revenue);
    const eCPMData = mockData.data.map(item => item.total_ecpm);
    const clickData = mockData.data.map(item => item.total_clicks);
    const impressionsData = mockData.data.map(item => item.total_impressions);

    /* line with data labels */
    var options1 = {
        series: [
            {
                name: "Total Revenue", // 总收入
                data: totalRevenueData // 使用数据
            },
            {
                name: "eCPM", // 每千次展示收入
                data: eCPMData // 使用数据
            },
            {
                name: "Clicks", // 点击数
                data: clickData // 使用数据
            },
            {
                name: "Impressions", // 展示数
                data: impressionsData // 使用数据
            }
        ],
        chart: {
            height: 230,
            type: 'line',
            dropShadow: {
                enabled: true,
                color: '#000',
                top: 18,
                left: 7,
                blur: 10,
                opacity: 0.2
            },
            toolbar: {
                show: false
            }
        },
        colors: ['#8b7eff', '#35bdaa', '#FF4560', '#00E396'], // 颜色对应关系
        dataLabels: {
            enabled: true,
        },
        stroke: {
            curve: 'smooth',
            width: [1, 1, 1, 1]
        },
        title: {
            text: 'Total Revenue, eCPM, Clicks, and Impressions Over Time',
            align: 'left',
            style: {
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#8c9097'
            },
        },
        grid: {
            borderColor: '#f2f5f7',
        },
        markers: {
            size: 1
        },
        xaxis: {
            categories: labels, // 使用数据标签
            title: {
                text: '',
                fontSize: '13px',
                fontWeight: 'bold',
                style: {
                    color: "#8c9097"
                }
            },
            labels: {
                show: true,
                style: {
                    colors: "#8c9097",
                    fontSize: '11px',
                    fontWeight: 600,
                    cssClass: 'apexcharts-xaxis-label',
                },
            },
        },
        yaxis: {
            title: {
                text: 'Amount',
                fontSize: '13px',
                fontWeight: 'bold',
                style: {
                    color: "#8c9097"
                }
            },
            labels: {
                show: true,
                style: {
                    colors: "#8c9097",
                    fontSize: '11px',
                    fontWeight: 600,
                    cssClass: 'apexcharts-yaxis-label',
                },
            },
            min: 0 // 根据数据调整最小值
        },
        legend: {
            position: 'top',
            horizontalAlign: 'right',
            offsetX: -10
        },
        tooltip: {
            shared: true,
            intersect: false,
            y: {
                formatter: function (y, { seriesIndex }) {
                    if (typeof y !== "undefined") {
                        if (seriesIndex === 0 || seriesIndex === 1) { // 0: totalRevenueData, 1: eCPMData
                            return `$${y.toFixed(2)}`; // 添加$符号并格式化为两位小数
                        }
                        return y; // 其他数据不添加$
                    }
                    return y;
                }
            }
        }
    };
    var chart1 = new ApexCharts(document.querySelector("#remind_chart"), options1);
    chart1.render();

    var eCPMOptions = {
        series: [{
            name: "eCPM", 
            data: eCPMData // 使用数据
        }],
        chart: {
            height: 120,
            type: 'area',
            toolbar: {
                show: false
            }
        },
        colors: ['#FF7043'], // 颜色对应关系
        dataLabels: {
            enabled: false,
        },
        stroke: {
            curve: 'smooth',
            width: [2]
        },
        title: {
            text: '',
            align: 'left',
            style: {
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#8c9097'
            },
        },
        grid: {
            borderColor: '#f2f5f7',
        },
        markers: {
            size: 2
        },
        xaxis: {
            categories: labels, // 使用数据标签
            title: {
                text: '', // 设置为空以移除 x 轴标题
                fontSize: '13px',
                fontWeight: 'bold',
                style: {
                    color: "#8c9097"
                }
            },
            labels: {
                show: false, // 不显示 x 轴标签
            },
        },
        yaxis: {
            title: {
                text: '',
                fontSize: '13px',
                fontWeight: 'bold',
                style: {
                    color: "#8c9097"
                }
            },
            labels: {
                show: false, // 不显示 y 轴标签
            },
            min: 0 // 根据数据调整最小值
        },
        legend: {
            position: 'top',
            horizontalAlign: 'right',
            offsetX: -10
        },
        tooltip: {
            shared: true,
            intersect: false,
            y: {
                formatter: function (y) {
                    return `$${y.toFixed(2)}`; // 添加$符号并格式化为两位小数
                }
            }
        }
    };
    var eCPMChart = new ApexCharts(document.querySelector("#ecmp_chart"), eCPMOptions);
    eCPMChart.render();

    // 使用数据替代adsCpc15day和bingCpc15day
    const mockAdsCpcData = [0.45, 0.48, 0.42, 0.52, 0.46, 0.51, 0.44];
    const mockBingCpcData = [0.38, 0.41, 0.35, 0.44, 0.39, 0.43, 0.37];
    
    $(".adscpc").html("$"+mockAdsCpcData[mockAdsCpcData.length-1]);
    $(".bingcpc").html("$"+mockBingCpcData[mockBingCpcData.length-1]);
    
    var cpcOptions = {
        series: [
            {
                name: "Ads Average CPC", 
                data: mockAdsCpcData // 使用数据
            },
            {
                name: "Bing CPC", 
                data: mockBingCpcData // 使用数据
            }
        ],
        chart: {
            height: 120,
            type: 'area',
            toolbar: {
                show: false
            }
        },
        colors: ['#FF7043', '#35bdaa'], // 颜色对应关系
        dataLabels: {
            enabled: false,
        },
        stroke: {
            curve: 'smooth',
        },
        title: {
            text: '',
            align: 'left',
            style: {
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#8c9097'
            },
        },
        grid: {
            borderColor: '#f2f5f7',
        },
        markers: {
            size: 2
        },
        xaxis: {
            categories: labels, // 使用数据标签
            title: {
                text: '', // 设置为空以移除 x 轴标题
                fontSize: '13px',
                fontWeight: 'bold',
                style: {
                    color: "#8c9097"
                }
            },
            labels: {
                show: false, // 不显示 x 轴标签
            },
        },
        yaxis: {
            title: {
                text: '',
                fontSize: '13px',
                fontWeight: 'bold',
                style: {
                    color: "#8c9097"
                }
            },
            labels: {
                show: false, // 不显示 y 轴标签
            },
            min: 0 // 根据数据调整最小值
        },
        legend: {
            position: 'top',
            horizontalAlign: 'right',
            offsetX: -10
        },
        tooltip: {
            shared: true,
            intersect: false,
            y: {
                formatter: function (y) {
                    return `$${y.toFixed(2)}`; // 添加$符号并格式化为两位小数
                }
            }
        }
    };
    var cpcChart = new ApexCharts(document.querySelector("#cpc_chart"), cpcOptions);
    cpcChart.render();

    // 使用数据替代browserData
    const mockBrowserData = [
        { browser: 'Google Chrome', cpm_and_cpc_revenue: 1250.50 },
        { browser: 'Safari 14', cpm_and_cpc_revenue: 890.25 },
        { browser: 'Microsoft Edge', cpm_and_cpc_revenue: 650.75 },
        { browser: 'Firefox Other', cpm_and_cpc_revenue: 420.30 },
        { browser: 'Opera Other', cpm_and_cpc_revenue: 180.60 }
    ];

    // 过滤掉 cpm_and_cpc_revenue 小于 0.1 的数据
    const filteredBrowserData = mockBrowserData.filter(data => parseFloat(data.cpm_and_cpc_revenue) >= 0.1);

    // 提取浏览器名称和对应的收入
    const browserIcon = ['Firefox Other','Google Chrome','In-app browser','Microsoft Edge','Opera 6.0','Opera 7.Other','Opera Other','Safari 14','Safari Other','Yandex'];
    const labelsData = filteredBrowserData.map(data => {
        const browserName = data.browser === 'Safari (iPhone/iPod)' ? 'Safari Other' : data.browser;
        return `<img src="../images/browser/${browserIcon.indexOf(browserName) != -1 ? browserName : 'browser'}.svg" alt="${browserName}" style="width: 16px; height: 16px; margin-right: 5px;"> ${data.browser}`;
    });
    const seriesDataBrowser = filteredBrowserData.map(data => parseFloat(data.cpm_and_cpc_revenue));

    // 定义颜色数组
    const colors = ["rgb(139, 126, 255)", "rgba(53, 189, 170, 1)", "rgba(139, 126, 255, .08)", "#F66D00", "#FFC107", "#673AB7", "#009688", "#3F51B5"];

    var browseroptions = {
        series: seriesDataBrowser, // 使用数据
        chart: {
            height: 200,
            type: "donut",
            dropShadow: {
                enabled: true,
                color: "#000",
                top: -1,
                left: 3,
                blur: 3,
                opacity: 0.2,
            },
        },
        stroke: {
            width: 0,
        },
        plotOptions: {
            pie: {
                donut: {
                    labels: {
                        show: true,
                        total: {
                            showAlways: true,
                            show: true,
                            style: {
                                fontSize: '12px',
                                fontWeight: 'bold',
                                color: '#fff'
                            },
                            formatter: function(val) {
                                return `$${seriesDataBrowser.reduce((a, b) => a + b, 0).toFixed(2)}`; // 格式化为两位小数并添加$
                            },
                        },
                    },
                },
            },
        },
        colors: colors, // 使用定义的颜色数组
        labels: labelsData, // 使用数据标签
        dataLabels: {
            enabled: true,
            formatter: function (val) {
                return `${val.toFixed(2)}%`; // 格式化为百分比
            },
            style: {
                colors: ["#fff"],
            },
        },
        tooltip: {
            y: {
                formatter: function (val) {
                    return `$${val.toFixed(2)}`; // 悬浮提示中格式化为货币格式
                }
            }
        },
        states: {
            hover: {
                filter: "none",
            },
        },
        theme: {
            palette: "palette2",
        },
        title: {
            text: "Browser Type",
            align: "left",
            style: {
                fontSize: "12px",
                fontWeight: "700",
                color: "#333",
            },
        },
        responsive: [
            {
                breakpoint: 480,
                options: {
                    chart: {
                        width: 200,
                    },
                    legend: {
                        position: "bottom",
                    },
                },
            },
        ],
    };
    var browse = new ApexCharts(document.querySelector("#browser_chart"), browseroptions);
    browse.render();

    // 使用数据替代deviceData
    const mockDeviceData = [
        { device_category_name: 'Desktop', total_revenue: 1850.50 },
        { device_category_name: 'Mobile', total_revenue: 1250.25 },
        { device_category_name: 'Tablet', total_revenue: 450.75 }
    ];

    // 提取设备名称和对应的收入
    const deviceLabels = mockDeviceData.map(data => data.device_category_name);
    const deviceRevenueData = mockDeviceData.map(data => parseFloat(data.total_revenue));

    // 定义设备图表的颜色数组
    const deviceColors = ["rgb(139, 126, 255)", "rgba(53, 189, 170, 1)", "rgba(139, 126, 255, .08)"];

    // 设备图表选项
    var deviceOptions = {
        series: deviceRevenueData, // 使用数据
        chart: {
            height: 200,
            type: "donut", // 更改为donut类型
            dropShadow: {
                enabled: true,
                color: "#000",
                top: -1,
                left: 3,
                blur: 3,
                opacity: 0.2,
            },
        },
        stroke: {
            width: 0,
        },
        plotOptions: {
            pie: {
                donut: {
                    labels: {
                        show: true,
                        total: {
                            showAlways: true,
                            show: true,
                            style: {
                                fontSize: '12px',
                                fontWeight: 'bold',
                                color: '#fff'
                            },
                            formatter: function(val) {
                                return `$${deviceRevenueData.reduce((a, b) => a + b, 0).toFixed(2)}`; // 格式化为两位小数并添加$
                            },
                        },
                    },
                },
            },
        },
        colors: deviceColors, // 使用定义的颜色数组
        labels: deviceLabels, // 使用数据标签
        dataLabels: {
            enabled: true,
            formatter: function (val) {
                return `${val.toFixed(2)}%`; // 格式化为百分比
            },
            style: {
                colors: ["#fff"],
            },
        },
        tooltip: {
            y: {
                formatter: function (val) {
                    return `$${val.toFixed(2)}`; // 悬浮提示中格式化为货币格式
                }
            }
        },
        states: {
            hover: {
                filter: "none",
            },
        },
        theme: {
            palette: "palette2",
        },
        title: {
            text: "Device Type",
            align: "left",
            style: {
                fontSize: "12px",
                fontWeight: "700",
                color: "#333",
            },
        },
        responsive: [
            {
                breakpoint: 480,
                options: {
                    chart: {
                        width: 200,
                    },
                    legend: {
                        position: "bottom",
                    },
                },
            },
        ],
    };

    // 渲染设备图表
    var deviceChart = new ApexCharts(document.querySelector("#device_chart"), deviceOptions);
    deviceChart.render();
}

$("#dateRange").on('change',function(){
    const range = $(this).val(); 
    const dateRange = getDateRange(range);
    const currentUrl = new URL(window.location.href); // 获取当前URL
    currentUrl.searchParams.set('range', dateRange); // 设置range参数
    currentUrl.searchParams.set('datetype', range); // 设置datetype参数
    window.location.href = currentUrl.toString(); // 跳转到更新后的URL
})

$(".remind_type_item").on('click',function(){
    const type = $(this).attr('data-type');
    const currentUrl = new URL(window.location.href); // 获取当前URL
    currentUrl.searchParams.set('type', type); // 设置type参数
    window.location.href = currentUrl.toString(); // 跳转到更新后的URL
})

$("#siteSelect").on('change', function() {
    const siteSelect = $(this).val(); 
    const currentUrl = window.location.href.split('?')[0]; // 获取当前URL
    const urlParams = new URLSearchParams(window.location.search);
    
    // 替换sites参数
    urlParams.set('sites', siteSelect);
    
    // 重新请求
    window.location.href = `${currentUrl}?${urlParams.toString()}`;
});


// 获取日期范围的函数
function getDateRange(range) {
    let startDate = '';
    let endDate = '';
    const today = new Date();

    // 自定义日期格式：YYYY-MM-DD
    function formatDate(date) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0'); // 月份从 0 开始，所以加 1
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    switch(range) {
        case 'today':
            startDate = formatDate(today);
            endDate = startDate;
            break;
        case 'yesterday':
            today.setDate(today.getDate() - 1);
            startDate = formatDate(today);
            endDate = startDate;
            break;
        case 'last7days':
            const last7Days = new Date();
            last7Days.setDate(today.getDate() - 6);
            startDate = formatDate(last7Days);
            endDate = formatDate(today);
            break;
        case 'last14days':
            const last14Days = new Date();
            last14Days.setDate(today.getDate() - 13);
            startDate = formatDate(last14Days);
            endDate = formatDate(today);
            break;
        case 'thismonth':
            startDate = formatDate(new Date(today.getFullYear(), today.getMonth(), 1));
            endDate = formatDate(today);
            break;
        case 'lastmonth':
            const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const firstOfLastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
            const lastOfLastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
            startDate = formatDate(firstOfLastMonth);
            endDate = formatDate(lastOfLastMonth);
            break;
    }

    return startDate + ' - ' + endDate;
}



async function fetchData(url) {
    const response = await fetch(url);
    return response.json();
}

async function loadDomainDetails() {
    const { domain, filePath,site,range } = getQueryParams();

    $(".google_ads").attr('href', `ads?type=google&site=${encodeURIComponent(site)}&range=${encodeURIComponent(range)}`);
    $(".bing_ads").attr('href', `ads?type=bing&site=${encodeURIComponent(site)}&range=${encodeURIComponent(range)}`);
}

function sortTable(column) {
    // 更新排序状态
    if (currentSort.column === column) {
        currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.order = 'asc';
    }

    // 更新表头箭头样式
    const tableHeaders = document.querySelectorAll('.table_h');
    tableHeaders.forEach(header => {
        const dataType = header.getAttribute('data-type');
        if (dataType === column) {
            header.classList.remove('asc', 'desc');
            header.classList.add(currentSort.order);
        } else {
            header.classList.remove('asc', 'desc');
        }
    });

    // 排序数据
    const sortedData = {};
    const rows = [];
    for (const key in cachedData) {
        if (key !== 'Total') {
            rows.push({ key, ...cachedData[key] });
        }
    }

    rows.sort((a, b) => {
        const valueA = a[column];
        const valueB = b[column];
        if (currentSort.order === 'asc') {
            return valueA - valueB;
        } else {
            return valueB - valueA;
        }
    });

    rows.forEach(row => {
        const { key, ...stats } = row;
        sortedData[key] = stats;
    });

    sortedData['Total'] = cachedData['Total']; // 保留总计行

    // 重新渲染表格
    renderTable(sortedData, getSelectedGroupBy());
}




function formatNumberWithK(value) {
    if (typeof value === 'string') {
        value = Number(value);
    }

    if (typeof value !== 'number' || isNaN(value)) {
        throw new Error('Input must be a valid number');
    }

    if (value >= 1000000000) {
        return (value / 1000000000).toFixed(2).replace(/\.0$/, '') + 'B';
    }

    if (value >= 1000000) {
        return (value / 1000000).toFixed(2).replace(/\.0$/, '') + 'M';
    }

    if (value >= 10000) {
        return (value / 1000).toFixed(2).replace(/\.0$/, '') + 'k';
    }

    return value.toString();
}

renderPorfit();
function renderPorfit(){
    var roi = parseFloat($(".roi_d").html().trim().replace(/[$%]/g, '')) - 100; // 去掉$和%再减去1
    roi = roi.toFixed(2);
    var options = {
        chart: {
            height: 200,
            type: 'radialBar',
            responsive: 'true',
            offsetX: 0,
            offsetY: -10,
            zoom: {
              enabled: false
            }
          },
          grid: {
            padding: {
              top: 0,
              right: 0,
              bottom: 0,
              left: 0
            },
          },
          plotOptions: {
            radialBar: {
              startAngle: -135,
              endAngle: 135,
              track: {
                strokeWidth: "80%",
              },
              hollow: {
                size: "55%"
              },
              dataLabels: {
                name: {
                  fontSize: '15px',
                  color: '#000',
                  offsetY: 20,
                  fontWeight: [400]
                },
                value: {
                  offsetY: -20,
                  fontSize: '22px',
                  color: '#000',
                  fontWeight: [600],
                  formatter: function (val) {
                    return val + "%";
                  }
                }
              }
            }
          },
          colors: ['rgb(139, 126, 255)'],
          fill: {
            type: 'gradient',
            gradient: {
              shadeIntensity: 1,
              type: "horizontal",
              gradientToColors: ["rgb(53, 189, 170)"],
              opacityFrom: 1,
              opacityTo: 1,
              stops: [0, 100]
            }
          },
          stroke: {
            dashArray: 4
          },
          labels: ['ROI'],
          series: [roi],
        };

	var chart = new ApexCharts(document.querySelector("#recentorders"), options);
	chart.render();
}

function toggleCompare() {
    const compareSwitch = document.getElementById('compare-switch');
    const currentUrl = new URL(window.location.href); // 获取当前URL

    if (compareSwitch.checked) {
        currentUrl.searchParams.set('compare', 'true'); // 添加compare参数为true
        var compareDemoNumber = $(".compare_demo").length;
        if(compareDemoNumber > 0){
            $(".compare_demo").show();
            window.history.replaceState({}, '', currentUrl.toString());
        }else{
            window.location.href = currentUrl.toString(); // 跳转到更新后的URL
        }
    
    } else {
        currentUrl.searchParams.delete('compare'); // 删除compare参数
        $(".compare_demo").hide();
        window.history.replaceState({}, '', currentUrl.toString());
    }

  
}
window.onload = loadDomainDetails;
