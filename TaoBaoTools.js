// ==UserScript==
// @name         淘宝工具箱 1.0
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  淘宝后台增强
// @author       xchen
// @match        https://item.upload.taobao.com/*
// @match        https://sell.publish.tmall.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict'
    console.log('=============淘宝工具箱==============')
    //==钩子====/
    // 备份原始 XMLHttpRequest
    const originalXHR = XMLHttpRequest.prototype.send

    // 重写 XMLHttpRequest 的 send 方法
    XMLHttpRequest.prototype.send = function () {
        const xhr = this
        // const url = xhr._url || xhr.responseURL
        //监听响应事件
        const originOnLoad = xhr.onload
        xhr.onload = function () {
            if (originOnLoad) {
                originOnLoad.apply(xhr, arguments)
            }
        }
        // 调用原始 send 方法
        originalXHR.apply(this, arguments)
    }

    // 重写 open 方法，捕获请求 URL
    const originalOpen = XMLHttpRequest.prototype.open
    XMLHttpRequest.prototype.open = function (method, url) {
        this._url = url // 保存请求的 URL
        originalOpen.apply(this, arguments)
    }
    //====监听url变化===/
    // window.addEventListener('popstate', function (event) {
       
    // })
    //==方法区====/

    // 复制内容到剪切板
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text)
    }

    //==================商品编辑增强，自动填充商品编码===========/
    class ProductEditEnhance {
        constructor() {
            console.log('=====商品编辑增强=====')
            this.init()
        }

        init() {
            const toolDiv = document.createElement('div')
            toolDiv.id = 'tool-div'
            // toolDiv.style.width = '100%'
            // toolDiv.style.height = '40px'
            // 添加按钮
            const showModalBtn = document.createElement('button')
            showModalBtn.innerText = '填充商品编码'
            showModalBtn.style.padding = '10px 10px'
            showModalBtn.style.margin = '0 0 0 10px'
            showModalBtn.style.fontSize = '12px'
            showModalBtn.style.backgroundColor = '#4CAF50'
            showModalBtn.style.color = 'white'
            showModalBtn.style.border = 'none'
            showModalBtn.style.borderRadius = '20px'
            showModalBtn.style.cursor = 'pointer'
            toolDiv.appendChild(showModalBtn)
            // 定义旋转动画的 CSS
            const style = document.createElement('style')
            style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `
            document.head.appendChild(style)
            // 选择目标元素
            const fullScreenCard = document.querySelector('.button-set .front');
            // 如果目标元素已经存在，直接插入子元素
            let waitTime = 0
            if (fullScreenCard) {
                fullScreenCard.appendChild(toolDiv)
            } else {
                const intervalId = setInterval(() => {
                    console.log('Waiting for full-screen-card...')
                    waitTime++
                    const target = document.querySelector('.button-set .front')
                    if (target) {
                        clearInterval(intervalId)  // 停止轮询
                        target.appendChild(toolDiv)
                    }
                    if (waitTime > 100){
                        console.log('没有找到插入点...结束...');
                        return;
                    }
                }, 1000)
            }

            showModalBtn.addEventListener('click', () => {
                showModalBtn.scrollIntoView({behavior: 'smooth', block: 'start'})

                const skuColorEle = document.querySelector('#struct-p-1627207')
                const colorValues = Object.values(skuColorEle)[0].memoizedProps.children[2].props.value
                const colorSet = []
                colorValues.forEach(colorValue => {
                    colorSet.push(colorValue.text)
                })

                // 弹窗生成用户输入区域
                const modal = document.createElement('div')
                modal.style.position = 'fixed'
                modal.style.top = '0'
                modal.style.left = '0'
                modal.style.width = '100%'
                modal.style.height = '100%'
                modal.style.overflow = 'auto'
                modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
                modal.style.zIndex = '9998'
                modal.innerHTML = `
            <div style="text-align: center;position: absolute; transform: translate(75%, 10%); background: white; padding: 20px; border-radius: 10px; width: 700px; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);">
                <h3>快速填充商品编码</h3>
                <h5 style="color:red">注：表格第一行没有更新没关系，点击保存就会更新</h5>
                <table style="width: 100%; margin-bottom: 20px; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th style="padding: 8px; border: 1px solid #ccc;">颜色分类</th>
                            <th style="padding: 8px; border: 1px solid #ccc;">前缀</th>
                            <th style="padding: 8px; border: 1px solid #ccc;">后缀</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${colorSet.map(key => `
                            <tr>
                                <td style="padding: 8px; border: 1px solid #ccc;">${key}</td>
                                <td style="padding: 8px; border: 1px solid #ccc;">
                                    <input type="text" class="color-prefix" data-color="${key}" data-color-id="${key}" style="width: 100%; padding: 6px; border: 1px solid #ccc;" />
                                </td>
                                <td style="padding: 8px; border: 1px solid #ccc;">
                                    <input type="text" class="color-suffix" data-color="${key}" data-color-id="${key}" style="width: 100%; padding: 6px; border: 1px solid #ccc;" />
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <span id="process" style="display: none;margin-top: 10px;">正在更新第：<span id="count">0</span>条</span>
                <button id="submit-prefixes" style="padding: 10px 20px; font-size: 16px; background-color: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer;  float:right">
                <span id="btn-text">确定</span>
                <div id="loading-spinner" style="display: none; border: 3px solid white; border-top: 3px solid transparent; border-radius: 50%; width: 16px; height: 16px; animation: spin 1s linear infinite;"></div>
                </button>
                <button id="cancel-prefixes" style="padding: 10px 20px; font-size: 16px; background-color: #f44336; color: white; border: none; border-radius: 5px; cursor: pointer; margin-right: 10px;float:right">取消</button>
            </div>
        `
                document.body.appendChild(modal)
                const submitBtn = document.getElementById('submit-prefixes')
                const processEle = document.getElementById('process')
                const countEle = document.getElementById('count')
                // 确定按钮点击后处理输入的数据
                submitBtn.addEventListener('click', () => {
                    //先获取数据
                    const eTableEles = document.querySelectorAll('div.sell-sku-table-wrapper-new')
                    processEle.style.display = 'inline-block'
                    let values = Object.values(eTableEles[0]);
                    //必须取第一个元素
                    const fiberNode = values[0]
                    const memoizedProps = fiberNode.memoizedProps
                    const fn = memoizedProps.children[1].props.onChange;
                    const dataSource = memoizedProps.children[1].props.dataSource
                    const value = memoizedProps.children[1].props.value
                    // 显示加载动画
                    document.getElementById('btn-text').style.display = 'none'
                    document.getElementById('loading-spinner').style.display = 'inline-block'
                    const allCount = dataSource.length
                    let count = 0
                    //处理数据
                    const prefixMap = {}
                    const suffixMap = {}
                    document.querySelectorAll('.color-prefix').forEach(input => {
                        prefixMap[input.getAttribute('data-color-id')] = input.value
                    })
                    document.querySelectorAll('.color-suffix').forEach(input => {
                        suffixMap[input.getAttribute('data-color-id')] = input.value
                    })
                    
                    for (let i = 0; i < dataSource.length; i++){
                        const item = dataSource[i];
                        const valueItem = value[i];
                        const color = item.props[0].text
                        const size = item.props[1].text.replace('码','')
                        // 获取用户输入的前缀
                        const prefix = prefixMap[color] || ''
                        const suffix = suffixMap[color] || ''
                        setTimeout(()=>{
                            if (size) {
                                if (prefix && prefix.length > 0) {
                                    // 拼接前缀和鞋码大小
                                    item.skuOuterId = prefix + size + suffix // 填充商品编码
                                    valueItem.skuOuterId = item.skuOuterId
                                    const update = {"skuOuterId": item.skuOuterId}
                                    fn(value, i, update)
                                } else if (suffix && suffix.length > 0) {
                                    const lastValue = item.skuOuterId
                                    item.skuOuterId = lastValue + suffix // 填充商品编码
                                    valueItem.skuOuterId = item.skuOuterId
                                    const update = {"skuOuterId": item.skuOuterId}
                                    fn(value, i, update)
                                    //  console.log(prefix, suffix, index, '更新')
                                }
                            }
                            count++
                            countEle.textContent = count
                        },0)
                    }
                    

                    // 关闭弹窗
                    function checkCompleted() {
                        setTimeout(() => {
                            if (allCount == count) {
                                document.body.removeChild(modal)
                            } else {
                                checkCompleted()
                            }
                        }, 500)
                    }

                    checkCompleted()
                })

                // 取消按钮点击后关闭弹窗
                document.getElementById('cancel-prefixes').addEventListener('click', () => {
                    // 关闭弹窗
                    document.body.removeChild(modal)
                })
            })
        }
    }

    if (location.href.includes('/sell/v2/publish.htm') ||location.href.includes('/tmall/publish.htm') ) {
        new ProductEditEnhance()
    }
    //==================商品编辑增强，自动填充商品编码 END=======/

})()
