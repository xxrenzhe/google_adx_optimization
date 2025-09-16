var range = '';

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

// 初始化排序
order.init({
    // 请获取class=container下的table的节点
    el: document.getElementsByClassName('domain-table')[0].getElementsByTagName('table')[0],
});
order2.init({
    el: document.getElementsByClassName('domain-table2')[0].getElementsByTagName('table')[0],
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

renderApexchart(range);

async function renderApexchart() {
    // Mock data for daily revenue chart
    // 日收入图表数据
    const mockAdxTotalRevenue = {
        data: [
            { day: '2024-01-01', total_revenue: 1250.50 },
            { day: '2024-01-02', total_revenue: 1380.75 },
            { day: '2024-01-03', total_revenue: 1120.30 },
            { day: '2024-01-04', total_revenue: 1450.90 },
            { day: '2024-01-05', total_revenue: 1320.60 },
            { day: '2024-01-06', total_revenue: 1580.25 },
            { day: '2024-01-07', total_revenue: 1290.80 }
        ]
    };

    const mockOfferTotalRevenue = {
        data: {
            '2024-01-01': 850.25,
            '2024-01-02': 920.50,
            '2024-01-03': 780.30,
            '2024-01-04': 1050.75,
            '2024-01-05': 890.40,
            '2024-01-06': 1120.90,
            '2024-01-07': 950.60
        }
    };

    const mockYahooRevenue = {
        data: {
            daily_revenue_summary: [
                { date: '2024-01-01', revenue: '$650.30' },
                { date: '2024-01-02', revenue: '$720.80' },
                { date: '2024-01-03', revenue: '$580.50' },
                { date: '2024-01-04', revenue: '$810.25' },
                { date: '2024-01-05', revenue: '$690.75' },
                { date: '2024-01-06', revenue: '$890.40' },
                { date: '2024-01-07', revenue: '$750.90' }
            ]
        }
    };

    // Process x-axis categories (keys from mockAdxTotalRevenue.data)
    var categories = mockAdxTotalRevenue.data.map(item => {
        return item.day; // Assuming 'day' is the date field in each data entry
    });

    // Process ADX data (total_revenue from mockAdxTotalRevenue.data)
    var adxData = mockAdxTotalRevenue.data.map(item => {
        return item.total_revenue; // Assuming 'day' is the date field in each data entry
    });

    // Process Offer data (value from mockOfferTotalRevenue.data)
    var offerData = categories.map(date => {
        return parseFloat(mockOfferTotalRevenue.data[date] || 0); // Directly using date as key
    });
    
    // Process Yahoo data (revenue from mockYahooRevenue.data.daily_revenue_summary)
    var yahooData = categories.map(category => {
        let revenueEntry = mockYahooRevenue.data.daily_revenue_summary.find(item => item.date === category);
        return parseFloat(revenueEntry?.revenue.replace('$', '').replace(',', '') || 0);
    });

    // ApexCharts configuration
    var options = {
        chart: {
            height: 300,
            type: 'line',
            stacked: true // Enable stacking
        },
        series: [
            {
                name: 'ADX',
                type: 'column',
                data: adxData
            },
            {
                name: 'Offer',
                type: 'column',
                data: offerData
            },
            {
                name: 'Yahoo',
                type: 'column',
                data: yahooData
            }
        ],
        stroke: {
            width: [0, 0, 4] // Line and bar stroke width
        },
        title: {
            text: 'Benefit Summary',
            align: 'center'
        },
        xaxis: {
            categories: categories // Set categories dynamically
        },
        yaxis: {
            title: {
                text: '金额 ($)'
            }
        },
        legend: {
            position: 'top'
        },
        tooltip: {
            shared: true,
            intersect: false
        },
        colors: ['#8B7EFF', '#E2DEFB', '#BCB4FA'], // Colors for series
        plotOptions: {
            bar: {
                horizontal: false,
                columnWidth: '55%', // Bar width
                endingShape: 'flat', // Flat bar end
                dataLabels: {
                    position: 'top' // Data label position
                }
            }
        },
        grid: {
            borderColor: '#e7e7e7',
            strokeDashArray: 4 // Dashed grid lines
        },
        fill: {
            opacity: 1, // 确保柱状图的颜色不透明
        }
    };

    // Render the chart
    var chart = new ApexCharts(document.querySelector("#chart"), options);
    chart.render();
}

function redPiaChart(data){
    // 使用数据替代真实数据
    var yahooData = 1250.00; // 数据：Yahoo收入
    var adxData = 1800.00; // 数据：ADX收入
    var offerData = 50.00; // 数据：Offer收入
    
    var dataRend = [Number(adxData), Number(offerData), Number(yahooData)];
    
    var options = {
        series: dataRend,
        chart: {
            height: 300,
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
                            style:{
                                fontSize:'20px',
                                fontWeight:'bold',
                                color:'#fff'
                            },
                            formatter: function(val) {
                                return (Number(adxData) + Number(offerData) + Number(yahooData)).toFixed(2);
                            },
                        },
                    },
                },
            },
        },
        colors: ["rgb(139, 126, 255)", "rgba(53, 189, 170, 1)", "rgba(139, 126, 255, .08)"],
        labels: ["ADX", "Offer", "Yahoo"],
        dataLabels: {
            enabled: true,
            style: {
                colors: ["#fff"],
            },
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
            text: "Proportion Of Income",
            align: "left",
            style: {
                fontSize: "13px",
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
    var chart = new ApexCharts(document.querySelector("#donut-pattern"), options);
    chart.render();
}

renderPorfit();
function renderPorfit(){
    var roi = parseFloat(150) - 100; // 去掉$和%再减去1
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

$("#dateRange").on('change',function(){
    const range = $(this).val(); 
    const dateRange = getDateRange(range);
    const currentUrl = new URL(window.location.href); // 获取当前URL
    currentUrl.searchParams.set('range', dateRange); // 设置range参数
    currentUrl.searchParams.set('datetype', range); // 设置datetype参数
    window.location.href = currentUrl.toString(); // 跳转到更新后的URL
})

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

let currentPage = 1;
const pageSize = 15;
let currentData = null; // Store the current data
let currentSort = { column: '', order: 'asc' }; // Current sort state
const filePath = 'all/2.csv';
const yahooPath = 'yahoo/yahoo.csv';
let ranges = new URLSearchParams(window.location.search).get('range') || '';
var start_date = '';
var end_date = '';
if(ranges == ''){
    var today = new Date();
    today.setDate(today.getDate() - 1);
    start_date = today.toISOString().split('T')[0];
    end_date = start_date;
}else{
    ranges = ranges.split(' - ');
    start_date = ranges[0];
    end_date = ranges[1];
}


async function fetchData(url) {
    const response = await fetch(url);
    return response.json();
}

async function loadDomainStats() {

    if (!filePath) {
        alert('Please enter the file path.');
        return;
    }

    // Mock data for Yahoo statistics
    const mockYahooData = {
        data: {
            total_income: '$1,250.00',
            totalImpressions: 45000,
            totalPageviews: 32000,
            totalPaidClicks: 1250
        }
    };
  
    var number = parseFloat(mockYahooData.data.total_income.replace(/[$,]/g, ''));
    redPiaChart(formatNumberWithK(number.toFixed(2)))
    $(".yaHoo_r").html(formatNumberWithK(number.toFixed(2)));
    $(".yahooImpressions").html(formatNumberWithK(mockYahooData.data.totalImpressions.toFixed(2)));
    $(".yahoopv").html(formatNumberWithK(mockYahooData.data.totalPageviews.toFixed(2)));
    $(".yahoopc").html(formatNumberWithK(mockYahooData.data.totalPaidClicks.toFixed(2)));
    $(".yahooDetails").attr('href', 'yahoo-report');
    
}

function sortTable(column) {
    if (!currentData) return;

    // Update sort order
    if (currentSort.column === column) {
        currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.order = 'asc';
    }

    // Update header styles
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

    // Sort data, including Total row
    const sortedData = Object.entries(currentData)
        .sort(([, a], [, b]) => {
            const valueA = a[column] || 0; // 处理可能的 undefined
            const valueB = b[column] || 0; // 处理可能的 undefined
            return currentSort.order === 'asc' ? valueA - valueB : valueB - valueA;
        });

    currentData = Object.fromEntries(sortedData);
    renderTable(currentData);
}

function renderTable(datas) {
    const table = document.getElementById('domain-table');

    // 清空表格
    table.innerHTML = `<tr>
        <th></th>
        <th>Domain</th>
        <th><div data-type='IMPRESSIONS' class="table_h ${currentSort.column === 'IMPRESSIONS' ? currentSort.order : ''}" onclick="sortTable('IMPRESSIONS')">Impressions <div class="sorting"></div></div></th>
        <th><div data-type='CLICKS' class="table_h ${currentSort.column === 'CLICKS' ? currentSort.order : ''}" onclick="sortTable('CLICKS')">Clicks <div class="sorting"></div></div></th>
        <th><div data-type='CTR' class="table_h ${currentSort.column === 'CTR_AVG' ? currentSort.order : ''}" onclick="sortTable('CTR_AVG')">CTR (Avg) <div class="sorting"></div></div></th>
        <th><div data-type='AVERAGE_ECPM' class="table_h ${currentSort.column === 'AVERAGE_ECPM_AVG' ? currentSort.order : ''}" onclick="sortTable('AVERAGE_ECPM_AVG')">eCPM (Avg) <div class="sorting"></div></div></th>
        <th><div data-type='REVENUE' class="table_h ${currentSort.column === 'REVENUE' ? currentSort.order : ''}" onclick="sortTable('REVENUE')">Revenue <div class="sorting"></div></div></th>
        <th><div data-type='COST' class="table_h ${currentSort.column === 'cost' ? currentSort.order : ''}" onclick="sortTable('cost')">Cost <div class="sorting"></div></div></th>
        <th><div data-type='PROFIT' class="table_h ${currentSort.column === 'Profit' ? currentSort.order : ''}" onclick="sortTable('Profit')">Profit <div class="sorting"></div></div></th>
        <th><div data-type='ROI' class="table_h ${currentSort.column === 'ROI' ? currentSort.order : ''}" onclick="sortTable('ROI')">ROI <div class="sorting"></div></div></th>
        <th><div data-type='ARPU' class="table_h ${currentSort.column === 'ARPU' ? currentSort.order : ''}" onclick="sortTable('ARPU')">ARPU <div class="sorting"></div></div></th>
    </tr>`;

    let totalRow = { IMPRESSIONS: 0, CLICKS: 0, REVENUE: 0, cost: 0, CTR_AVG: 0, AVERAGE_ECPM_AVG: 0, Profit: 0, ROI: 0 ,arpu:0};

    // 计算总计
    if (datas && typeof datas === 'object') {
        for (const domain in datas) {
            const stats = datas[domain];
            if(stats == 'Total'){
                return;
            }
            totalRow.IMPRESSIONS += stats.IMPRESSIONS || 0;
            totalRow.CLICKS += stats.CLICKS || 0;
            totalRow.REVENUE += stats.REVENUE || 0;
            totalRow.cost += stats.cost || 0;
            totalRow.CTR_AVG += stats.CTR_AVG || 0; // 如果需要处理 CTR_AVG 计算
            totalRow.AVERAGE_ECPM_AVG += stats.AVERAGE_ECPM_AVG || 0; // 如果需要处理 ECPM 计算
        }
    } else {
        alert('No valid stats found in the data.');
    }

    var totalArpu = 0;
    var domainCount = 0;
    if (datas && typeof datas === 'object') {
        for (const domain in datas) {
            if(datas[domain] == 'Total'){
                return;
            }
            totalArpu += datas[domain].arpu || 0; // 累加 ARPU
            domainCount++; // 计数有效的域
        }
    }
    console.log(totalArpu,domainCount)
    
    // 计算平均 ARPU
    const averageArpu = domainCount > 0 ? (totalArpu / domainCount).toFixed(2) : 0;
    // 渲染总计行
    const totalRowHtml = `<tr>
        <td></td>
        <td>Total</td>
        <td>${datas['Total'].IMPRESSIONS}</td>
        <td>${datas['Total'].CLICKS}</td>
        <td>${datas['Total'].CTR_AVG.toFixed(2)}%</td>
        <td>$${datas['Total'].AVERAGE_ECPM_AVG .toFixed(2)}</td>
        <td>$${datas['Total'].REVENUE.toFixed(2)}</td>
        <td>$${totalRow.cost.toFixed(2)}</td>
        <td>$${(datas['Total'].REVENUE - totalRow.cost).toFixed(2)}</td>
        <td>${(totalRow.cost === 0 ? 'N/A' : ((totalRow.REVENUE / totalRow.cost) * 100).toFixed(2) + '%')}</td>
        <td>$${averageArpu}</td>
    </tr>`;
    table.innerHTML += totalRowHtml;

    // 渲染其他数据行
    const sortedEntries = Object.entries(datas).sort(([, a], [, b]) => {
        const valueA = a[currentSort.column] || 0;
        const valueB = b[currentSort.column] || 0;
        return currentSort.order === 'asc' ? valueA - valueB : valueB - valueA;
    });

    sortedEntries.forEach(([domain, stats]) => {
        if(domain == 'Total'){
            return;
        }
        var revenue = Number(stats.REVENUE) || 0; // 确保 REVENUE 是一个有效数字
        var cost = Number(stats.cost) || 0; // 确保 cost 是一个有效数字
        
        var totalProfit = revenue - cost; // 计算利润
        
        var totalRoi;
        if (revenue === 0) {
            totalRoi = 'N/A'; // 如果 REVENUE 为 0，ROI 为 N/A
        } else {
            totalRoi = cost > 0 ? (revenue / cost) * 100 : 100; // 计算 ROI，避免 NaN
        }
        
        const row = `<tr>
            <td class="more_btn"><img src="./images/add.svg" alt="add"></td>
            <td><a class="link" href="report?domain=${encodeURIComponent(domain)}&file_path=${encodeURIComponent(filePath)}">${domain}</a></td>
            <td>${stats.IMPRESSIONS}</td>
            <td>${stats.CLICKS}</td>
            <td>${(stats.CTR_AVG || 0).toFixed(4)}%</td>
            <td>$${Number(stats.AVERAGE_ECPM_AVG).toFixed(2)}</td>
            <td>$${Number(stats.REVENUE).toFixed(2)}</td>
            <td>$${stats.cost ? stats.cost : 0}</td>
            <td class="${totalProfit > 0 ? 'positive-profit' : 'negative-profit'}">${'$' + formatNumberWithK(Number(totalProfit).toFixed(2))}</td>
            <td class="${totalRoi === 'N/A' ? '' : (totalRoi < 100 ? 'negative-roi' : 'positive-roi')}">${totalRoi === 'N/A' ? totalRoi : `${Number(totalRoi).toFixed(2)}%`}</td>
            <td>$${stats.arpu ? formatNumberWithK(Number(stats.arpu).toFixed(2)) : 0}</td>
        </tr>`;
        table.innerHTML += row;
    });
}

function updatePaginationControls() {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';

    const prevButton = document.createElement('button');
    prevButton.textContent = 'Previous';
    prevButton.disabled = currentPage === 1;
    prevButton.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            loadDomainStats();
        }
    };
    pagination.appendChild(prevButton);

    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next';
    nextButton.onclick = () => {
        currentPage++;
        loadDomainStats();
    };
    pagination.appendChild(nextButton);
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

function renderChart(data) {
    var myChart = echarts.init(document.getElementById('chart-container'));
    
    // Mock data for advertisers chart
    // 广告商图表数据
    const mockData = {
        data: {
            'Google Ads': { REVENUE: 12500.50 },
            'Facebook Ads': { REVENUE: 8900.25 },
            'Amazon Ads': { REVENUE: 15600.75 },
            'Microsoft Ads': { REVENUE: 7200.30 },
            'Twitter Ads': { REVENUE: 4500.80 },
            'LinkedIn Ads': { REVENUE: 6800.60 },
            'TikTok Ads': { REVENUE: 9200.40 },
            'Snapchat Ads': { REVENUE: 3800.90 }
        }
    };
    
    const categories = Object.keys(mockData.data);
    const values = categories.map(domain => mockData.data[domain].REVENUE.toFixed(2));

    const sortedData = categories.map((category, index) => ({ category, value: values[index] }))
        .sort((a, b) => a.value - b.value);

    const sortedCategories = sortedData.map(item => item.category);
    const sortedValues = sortedData.map(item => item.value);

    var option = {
        title: {
            text: '广告商',
            left: 'center'
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            containLabel: true
        },
        xAxis: {
            type: 'value',
            boundaryGap: [0, 0.01]
        },
        yAxis: {
            type: 'category',
            data: sortedCategories
        },
        series: [
            {
                name: '数据',
                type: 'bar',
                data: sortedValues,
                itemStyle: {
                    color: '#5470C6'
                }
            }
        ]
    };

    myChart.setOption(option);
}

function renderChartAdFormat(data) {
    var myChart = echarts.init(document.getElementById('chart-container1'));
    
    // Mock data for ad format chart
    // 广告格式图表数据
    const mockAdFormatData = {
        data: [{
            'Banner': { AVERAGE_ECPM: 2.45, IMPRESSIONS: 125000, REVENUE: 3062.50 },
            'Video': { AVERAGE_ECPM: 4.20, IMPRESSIONS: 85000, REVENUE: 3570.00 },
            'Native': { AVERAGE_ECPM: 3.15, IMPRESSIONS: 95000, REVENUE: 2992.50 },
            'Display': { AVERAGE_ECPM: 1.80, IMPRESSIONS: 150000, REVENUE: 2700.00 },
            'Mobile': { AVERAGE_ECPM: 2.95, IMPRESSIONS: 110000, REVENUE: 3245.00 },
            'Desktop': { AVERAGE_ECPM: 2.10, IMPRESSIONS: 135000, REVENUE: 2835.00 }
        }]
    };
    
    const groupedData = mockAdFormatData.data[0];

    const categories = Object.keys(groupedData);
    const adFormatEcpm = categories.map(key => groupedData[key].AVERAGE_ECPM.toFixed(2));
    const adFormatImpressions = categories.map(key => groupedData[key].IMPRESSIONS.toFixed(2));
    const adFormatRevenue = categories.map(key => groupedData[key].REVENUE.toFixed(2));

    var option1;

    option1 = {
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'cross',
                crossStyle: {
                    color: '#999'
                }
            }
        },
        toolbox: {
            feature: {
                dataView: { show: true, readOnly: false },
                magicType: { show: true, type: ['line', 'bar'] },
                restore: { show: true },
                saveAsImage: { show: true }
            }
        },
        legend: {
            data: ['Revenue', 'Impressions', 'eCPM']
        },
        xAxis: [
            {
                type: 'category',
                data: categories,
                axisPointer: {
                    type: 'shadow'
                }
            }
        ],
        yAxis: [
            {
                type: 'value',
                name: 'Revenue',
                min: 0,
                axisLabel: {
                    formatter: '{value} $'
                }
            },
            {
                type: 'value',
                name: 'Impressions',
                min: 0,
                axisLabel: {
                    formatter: '{value} '
                }
            },
            {
                type: 'value',
                name: 'eCPM',
                min: 0,
                axisLabel: {
                    formatter: '{value} $'
                }
            }
        ],
        series: [
            {
                name: 'Revenue',
                type: 'bar',
                data: adFormatRevenue
            },
            {
                name: 'Impressions',
                type: 'bar',
                data: adFormatImpressions
            },
            {
                name: 'eCPM',
                type: 'line',
                yAxisIndex: 2,
                tooltip: {
                    valueFormatter: function (value) {
                        return value + ' $';
                    }
                },
                data: adFormatEcpm
            }
        ]
    };
    myChart.setOption(option1);
}
if(profitArr.length > 0){
    profitArr = profitArr.filter(item => item.site !== 'All');
    var getSites = profitArr[0]['site'];
    getCompareAdvertisers(getSites);
    
}

$(".analytics_btn").on('click',function(){
    var sitesType = $(this).attr('data-site');
    if(sitesType != 'All'){
        getCompareAdvertisers(sitesType);
    }
})


async function getCompareAdvertisers(site) {
    var rangesDate = start_date + ' - ' + end_date;
    $(".site_analytics").html(site);
    
    // Mock data for advertisers comparison
    // 广告商对比数据
    const mockAdvertisersData = {
        data: {
            added_advertisers: [
                'TechCorp Solutions',
                'Digital Marketing Pro',
                'Innovation Labs',
                'Smart Ads Inc',
                'Future Media Group'
            ],
            removed_advertisers: [
                'Old School Ads',
                'Legacy Marketing',
                'Traditional Media Co',
                'Outdated Solutions',
                'Classic Advertisers'
            ],
            top_ecpm_advertisers: [
                {
                    classified_advertiser_name: 'Premium Tech Corp',
                    average_ecpm: 8.45,
                    revenue: 12500.75
                },
                {
                    classified_advertiser_name: 'Luxury Brands Inc',
                    average_ecpm: 7.82,
                    revenue: 9800.50
                },
                {
                    classified_advertiser_name: 'High Value Solutions',
                    average_ecpm: 6.95,
                    revenue: 8750.25
                },
                {
                    classified_advertiser_name: 'Elite Marketing Group',
                    average_ecpm: 6.20,
                    revenue: 7200.80
                }
            ],
            top_revenue_advertisers: [
                {
                    classified_advertiser_name: 'Mega Revenue Corp',
                    average_ecpm: 4.25,
                    revenue: 18500.90
                },
                {
                    classified_advertiser_name: 'Big Money Ads',
                    average_ecpm: 3.95,
                    revenue: 16200.75
                },
                {
                    classified_advertiser_name: 'Volume Marketing Inc',
                    average_ecpm: 3.50,
                    revenue: 14800.60
                },
                {
                    classified_advertiser_name: 'Scale Solutions',
                    average_ecpm: 3.20,
                    revenue: 13500.40
                }
            ]
        }
    };

    // 渲染新增广告商
    const addAdvertisers = mockAdvertisersData.data.added_advertisers || [];
    const reducedAdvertisers = mockAdvertisersData.data.removed_advertisers || [];
    const topEcpm = mockAdvertisersData.data.top_ecpm_advertisers || [];
    const topRevenue = mockAdvertisersData.data.top_revenue_advertisers || [];

    // 更新新增广告商
    $(".add_adveritser").html(`
        <table class="style_two">
           <thead>
                <tr><th>Add Advertisers</th></tr>
            </thead>
            <tbody>
                ${addAdvertisers.slice(0, 3).map(ad => `<tr><td>${ad}</td>`).join('')}
            </tbody>
        </table>
    `);

    // 更新减少广告商
    $(".reduced_adveritser").html(`
        <table class="style_two">
            <thead>
            <tr><th>Reduced Advertisers</th></tr>
            </thead>
             <tbody>
                ${reducedAdvertisers.slice(0, 3).map(ad => `<tr><td>${ad}</td>`).join('')}
             </tbody>
        </table>
    `);

    // 更新top eCPM
    $(".top_ecpm").html(`
        <table class="style_two">
            <thead>
            <tr><th>Top eCPM Advertisers</th><th>eCPM</th><th>Revenue</th></tr>
            </thead>
            <tbody>
            ${topEcpm.slice(0, 3).map(ad => `<tr><td>${ad.classified_advertiser_name}</td><td>$${formatNumberWithK(ad.average_ecpm.toFixed(2))}</td><td>$${formatNumberWithK(Number(ad.revenue).toFixed(2))}</td></tr>`).join('')}
            </tbody>
        </table>
    `);

    // 更新top revenue
    $(".top_revenue").html(`
        <table class="style_two">
            <thead>
                <tr><th>Top Revenue Advertisers</th><th>eCpm</th><th>Revenue</th></tr>
            </thead>
            <tbody>
            ${topRevenue.slice(0, 3).map(ad => `<tr><td>${ad.classified_advertiser_name}</td><td>$${formatNumberWithK(ad.average_ecpm.toFixed(2))}</td><td>$${formatNumberWithK(ad.revenue.toFixed(2))}</td></tr>`).join('')}
            </tbody>
            </table>
    `);
}


loadDomainStats();

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

