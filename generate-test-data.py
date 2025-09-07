#!/usr/bin/env python3
import csv
import random
import sys
from datetime import datetime, timedelta

# 生成50万行测试数据
print("生成50万行测试数据...")

# 网站列表
websites = ['example.com', 'test-site.org', 'demo.net', 'sample.io', 'fake-site.com'] * 20

# 国家列表
countries = ['美国', '中国', '日本', '韩国', '英国', '德国', '法国', '加拿大', '澳大利亚', '巴西']

# 广告格式
ad_formats = ['横幅广告', '插页式广告', '视频广告', '原生广告', '激励广告']

# 设备
devices = ['移动设备', '桌面设备', '平板电脑']

# 浏览器
browsers = ['Chrome', 'Safari', 'Firefox', 'Edge', 'Opera']

# 日期范围（最近30天）
start_date = datetime.now() - timedelta(days=30)
dates = [(start_date + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(30)]

# 生成数据
with open('test-data-500k.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    
    # 写入标题行
    writer.writerow([
        '网站', '国家/地区', '广告资源格式', '广告单元（所有级别）', '广告客户（已分类）', 
        '广告客户网域', '设备', '浏览器', '日期', 'Ad Exchange 请求总数', 
        'Ad Exchange 展示次数', 'Ad Exchange 点击次数', 'Ad Exchange 点击率', 
        'Ad Exchange 平均 eCPM', 'Ad Exchange 收入', 'Ad Exchange Active View可见展示次数', 
        'Ad Exchange Active View可见展示次数百分比', 'Ad Exchange Active View可衡量展示次数'
    ])
    
    # 生成50万行数据
    for i in range(500000):
        website = random.choice(websites)
        country = random.choice(countries)
        ad_format = random.choice(ad_formats)
        device = random.choice(devices)
        browser = random.choice(browsers)
        date = random.choice(dates)
        
        # 生成随机指标
        requests = random.randint(1000, 100000)
        impressions = random.randint(100, requests)
        clicks = random.randint(0, impressions // 100)
        ctr = (clicks / impressions * 100) if impressions > 0 else 0
        ecpm = random.uniform(0.1, 50)
        revenue = (impressions / 1000) * ecpm
        viewable_impressions = random.randint(int(impressions * 0.7), impressions)
        viewability_rate = (viewable_impressions / impressions * 100) if impressions > 0 else 0
        measurable_impressions = random.randint(int(impressions * 0.8), impressions)
        
        writer.writerow([
            website, country, ad_format, f"Ad Unit {random.randint(1, 100)}", 
            f"Advertiser {random.randint(1, 50)}", f"{random.choice(['google', 'facebook', 'amazon'])}.com",
            device, browser, date, requests, impressions, clicks, 
            round(ctr, 4), round(ecpm, 4), round(revenue, 4), 
            viewable_impressions, round(viewability_rate, 4), measurable_impressions
        ])
        
        if (i + 1) % 100000 == 0:
            print(f"已生成 {i + 1} 行...")

print(f"✅ 测试数据生成完成：test-data-500k.csv")

# 检查文件大小
import os
file_size = os.path.getsize('test-data-500k.csv')
print(f"文件大小：{file_size / 1024 / 1024:.2f} MB")