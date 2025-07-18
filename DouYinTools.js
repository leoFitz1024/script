// ==UserScript==
// @name         抖店增强工具箱
// @namespace    http://tampermonkey.net/
// @version      2.0.2
// @description  抖音小店后台功能增强
// @author       xchen
// @match        https://*.jinritemai.com/*
// @icon         https://lf1-fe.ecombdstatic.com/obj/eden-cn/upqphj/homepage/icon.svg
// @grant        none
// @run-at       document-start
// @updateURL    https://cdn.jsdmirror.com/gh/leoFitz1024/script@latest/DouYinTools.js
// @downloadURL  https://cdn.jsdmirror.com/gh/leoFitz1024/script@latest/DouYinTools.js
// ==/UserScript==

(function () {
    'use strict'
    console.log('=============抖店增强工具箱==============')
    //==钩子====/
    // 备份原始 XMLHttpRequest
    const originalXHR = XMLHttpRequest.prototype.send

    // 重写 XMLHttpRequest 的 send 方法
    XMLHttpRequest.prototype.send = function () {
        const xhr = this
        const url = xhr._url || xhr.responseURL
        //监听响应事件
        const originOnLoad = xhr.onload
        xhr.onload = function () {
            if (url.includes('/product/tproduct/list?')) {
                // 商品列表页增强
                if (productListEnhance) {
                    setTimeout(() => {
                        productListEnhance.updateProductMap(JSON.parse(xhr.responseText))
                    }, 500)
                }
            }
            //https://fxg.jinritemai.com/api/anchor/livepc/promotions_v2?list_type=1&source_type=force&
            if (url.includes('/api/anchor/livepc/promotions_v2?list_type=1&source_type=force')) {
                if (liveEnhance) {
                    setTimeout(() => {
                        liveEnhance.updateProductMap(JSON.parse(xhr.responseText))
                    }, 500)
                }
            }
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
    //直播增强
    let liveEnhance = null
    //商品列表页增强
    let productListEnhance = null
    window.addEventListener('popstate', function (event) {
        //判断url是否为直播页面
        if (location.href.includes('/dashboard/live/control?')) {
            if (!liveEnhance) {
                liveEnhance = new LiveEnhance()
            }
        } else {
            liveEnhance = null
        }
        //判断url是否为商品列表页
        if (location.href.includes('/ffa/g/list?')) {
            if (!productListEnhance) {
                productListEnhance = new ProductListEnhance()
            }
        } else {
            productListEnhance = null
        }
    })
    //==方法区====/

    // 复制内容到剪切板
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text)
    }

    //==================商品列表页增强：显示货号====================/
    class ProductListEnhance {
        constructor() {
            console.log('=====商品列表页增强=====')
            this.productMap = new Map()
            this.createMonitor()
        }

        // 更新商品列表
        updateProductMap(productListRes) {
            this.productMap.clear()
            for (let i = 0; i < productListRes.data.length; i++) {
                const product = productListRes.data[i]
                if (product.product_format_new && product.product_format_new[3171] && product.product_format_new[3171][0]) {
                    const code = product.product_format_new[3171][0]['name']
                    if (code){
                        this.productMap.set(product.product_id, code)
                    }
                }
            }
            this.refreshGoodCode()
        }

        // 创建 MutationObserver 观察目标元素
        createMonitor() {
            console.log('Creating MutationObserver...')
            const observer = new MutationObserver((mutationsList, observer) => {
                mutationsList.forEach(mutation => {
                    if (mutation.type === 'childList') {
                        this.refreshGoodCode()
                    }
                })
            })

            // 配置观察选项
            const config = {
                childList: true,      // 监听子元素的添加和删除
                attributes: false,     // 监听属性变化
                subtree: true         // 监听整个子树的变化
            }

            // 开始观察目标元素
            let goodsContainer = document.querySelector('[class^="ecom-g-table-wrapper"]')
            let tableInterval = setInterval(() => {
                if (!goodsContainer) {
                    goodsContainer = document.querySelector('[class^="ecom-g-table-wrapper"]')
                } else {
                    console.log('============开始监听table========')
                    observer.observe(goodsContainer, config)
                    clearInterval(tableInterval)
                }
            }, 1000)
        }

        //更新货号
        refreshGoodCode() {
            const productIdDivs = document.querySelectorAll('[class^="style_goodsIdNew__"]')
            if (productIdDivs.length > 0) {
                productIdDivs.forEach(productIdDiv => {
                    const productId = productIdDiv.children[0].innerText.substring(3)
                    const code = this.productMap.get(productId)
                    if (code) {
                        const goodsTextContainer = productIdDiv.parentElement
                        const goodsCodeDiv = goodsTextContainer.querySelector('[id="goodsCode"]')
                        if (!goodsCodeDiv) {
                            productIdDiv.insertAdjacentHTML('afterend',
                                `<div id="goodsCode" class="style_productTagContainerNew__gMlzf"><div style="color: #898b8f;margin-bottom: 5px;" class="goodsCodeText" data-code="${code}">货号: ${code}</div></div>`)
                        }
                    }
                })
                // 绑定点击事件
                const codeDivs = document.querySelectorAll('.goodsCodeText')
                codeDivs.forEach(codeDiv => {
                    codeDiv.addEventListener('click', () => {
                        copyToClipboard(codeDiv.dataset.code)
                    })
                })
            }
        }
    }

    //==================商品列表页增强 End====================/

    //==================直播增强，自动讲解、显示货号===========/
    class LiveEnhance {
        constructor() {
            console.log('=====直播增强=====')
            this.autoClickOn = false
            this.productMap = new Map()
            this.idToBtnMap = new Map()
            this.autoClickInterval = null
            this.skipCount = 0
            this.lastClickedId = null
            this.goodsContainer = document.getElementById('live-control-goods-list-container')
            if (this.goodsContainer) {
                this.createMonitor()
            } else {
                const intervalId = setInterval(() => {
                    console.log('Waiting for goods panel...')
                    this.goodsContainer = document.getElementById('live-control-goods-list-container')
                    if (this.goodsContainer) {
                        clearInterval(intervalId)  // 停止轮询
                        this.createMonitor()  // 执行初始化函数
                        // 添加开关控件
                        this.createToggleSwitch()
                    }
                }, 500)
            }
        }


        // 新增开关创建方法
        createToggleSwitch() {
            const toggleContainer = document.createElement('div')
            // toggleContainer.style.position = 'fixed'
            toggleContainer.style.top = '80px'
            toggleContainer.style.right = '20px'
            toggleContainer.style.zIndex = '1'
            toggleContainer.style.display = 'flex'
            toggleContainer.style.alignItems = 'center'
            toggleContainer.style.justifyContent = 'center'


            const switchLabel = document.createElement('label')
            switchLabel.className = 'switch'
            switchLabel.style.display = 'block'
            switchLabel.style.marginLeft = '8px'

            const checkbox = document.createElement('input')
            checkbox.type = 'checkbox'
            checkbox.checked = this.autoClickOn
            checkbox.addEventListener('change', (e) => {
                this.toggleFunctionality(e.target.checked)
            })

            const slider = document.createElement('span')
            slider.className = 'slider round'

            const statusText = document.createElement('span')
            statusText.textContent = '自动讲解 '
            statusText.style.color = 'rgba(31,31,31,0.95)'
            statusText.style.fontSize = '15px'
            statusText.style.marginLeft = '8px'

            // 添加样式
            const style = document.createElement('style')
            style.textContent = `
          .switch { position: relative; display: inline-block; width: 35px; height: 18px; }
          .switch input { opacity: 0; width: 0; height: 0; }
          .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; }
          .slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 2px; bottom: 2px; background-color: white; transition: .4s; }
          input:checked + .slider { background-color: #07C160; }
          input:checked + .slider:before { transform: translateX(18px); }
          .slider.round { border-radius: 20px; }
          .slider.round:before { border-radius: 50%; }
      `

            switchLabel.appendChild(checkbox)
            switchLabel.appendChild(slider)
            toggleContainer.appendChild(style)
            toggleContainer.appendChild(statusText)
            toggleContainer.appendChild(switchLabel)
            const navHeaders = document.getElementsByClassName('panelHeader-ln_vsr')
            //插入到navHeader第一个子元素之后
            if (navHeaders.length > 0) {
                navHeaders[0].insertBefore(toggleContainer, navHeaders[0].lastChild)
            }

            // 保存DOM引用
            this.toggleElements = {checkbox, slider, statusText}
        }

        // 开关功能切换
        toggleFunctionality(isEnabled) {
            isEnabled ? this.autoClickOn = true : this.autoClickOn = false
            this.lastClickedId = null
            this.refreshGoodsItems()
            // 这里可以添加开关状态对应的功能逻辑
            console.log(`自动讲解：${isEnabled ? '开启' : '关闭'}`)
        }

        // 更新商品列表
        updateProductMap(productListRes) {
            for (let i = 0; i < productListRes.data.promotions.length; i++) {
                const product = productListRes.data.promotions[i]
                if (product.promotion_id && product.art_no) {
                    this.productMap.set(product.promotion_id, product.art_no)
                }
            }
            this.refreshGoodsItems()
        }

        // 创建 MutationObserver 观察目标元素
        createMonitor() {
            console.log('Creating MutationObserver...')
            const observer = new MutationObserver((mutationsList, observer) => {
                mutationsList.forEach(mutation => {
                    if (mutation.type === 'childList') {
                        this.refreshGoodsItems()
                    }
                })
            })

            // 配置观察选项
            const config = {
                childList: true,      // 监听子元素的添加和删除
                attributes: false,     // 监听属性变化
                subtree: false         // 监听整个子树的变化
            }

            // 开始观察目标元素
            observer.observe(this.goodsContainer.children[0].children[0], config)
            this.refreshGoodsItems()
        }

        setButtonText(id, text) {
            const btn = this.idToBtnMap.get(id)
            if (btn) {
                btn.textContent = text
            }
        }

        // 更新id和按钮的映射关系
        refreshGoodsItems() {
            const goodsItems = this.goodsContainer.querySelectorAll('.rpa_lc__live-goods__goods-item')
            goodsItems.forEach(item => {
                //增加货号显示
                const productId = item.getAttribute('data-rbd-draggable-id')
                const code = this.productMap.get(productId)
                if (!code) {
                    return
                }
                const goodsTextContainer = item.querySelector('.right-mXg75w')
                const goodsCodeDiv = goodsTextContainer.querySelector('[id="goodsCode"]')
                if (!goodsCodeDiv) {
                    const newGoodsCodeDiv = document.createElement('div')
                    newGoodsCodeDiv.textContent = `货号: ${code}`
                    newGoodsCodeDiv.id = 'goodsCode'
                    newGoodsCodeDiv.style.color = '#565960'
                    newGoodsCodeDiv.style.fontSize = '12px'
                    newGoodsCodeDiv.style.marginTop = '2px'
                    newGoodsCodeDiv.style.cursor = 'pointer'
                    newGoodsCodeDiv.dataset.code = code
                    goodsTextContainer.appendChild(newGoodsCodeDiv)
                    newGoodsCodeDiv.addEventListener('click', () => {
                        copyToClipboard(newGoodsCodeDiv.dataset.code)
                    })
                } else {
                    goodsCodeDiv.textContent = `货号: ${code}`
                }
                // 实现自动讲解
                if (!this.autoClickOn) {
                    return
                }
                //按钮设置事件
                let buttons = item.querySelectorAll('.auxo-btn.auxo-btn-sm.lvc2-doudian-btn')
                if (buttons.length === 0) {
                    buttons = item.querySelectorAll('.lvc2-grey-btn')
                }
                buttons.forEach(button => {
                    const buttonText = button.textContent.trim()
                    if (buttonText.includes('讲解')) {
                        const id = item.getAttribute('data-rbd-draggable-id')
                        this.idToBtnMap.set(id, button)
                        if (buttonText.includes('取消讲解')) {
                            this.lastClickedId = id
                            this.startAutoClick()
                        }
                        this.setButtonText(id, id === this.lastClickedId ? '取消讲解' : '自动讲解')

                        button.addEventListener('click', (event) => {
                            if (event.isTrusted) {
                                if (this.autoClickInterval) {
                                    clearInterval(this.autoClickInterval)
                                }
                                const parentItem = event.target.closest('.rpa_lc__live-goods__goods-item')
                                const currentId = parentItem.getAttribute('data-rbd-draggable-id')
                                if (currentId === this.lastClickedId) {
                                    this.setButtonText(currentId, '自动讲解')
                                    this.lastClickedId = null
                                } else {
                                    this.setButtonText(this.lastClickedId, '自动讲解')
                                    this.lastClickedId = currentId
                                    this.setButtonText(currentId, '取消讲解')
                                    this.startAutoClick()
                                }
                            }
                        })
                    }
                })
            })
        }

        // 自动点击按钮
        startAutoClick() {
            this.skipCount = 0
            if (this.autoClickInterval) {
                clearInterval(this.autoClickInterval)
            }
            this.autoClickInterval = setInterval(() => {
                if (this.lastClickedId) {
                    const button = this.idToBtnMap.get(this.lastClickedId)
                    if (button) {
                        if (button.classList.contains('active') && this.skipCount < 5) {
                            this.skipCount++
                        } else {
                            this.skipCount = 0
                            button.click()
                        }
                    }
                } else {
                    clearInterval(this.autoClickInterval)
                }
            }, 2000)
        }
    }

    //==================直播增强，自动讲解、显示货号 END=======/

    //==================商品编辑增强，自动填充商品编码===========/
    class ProductEditEnhance {
        constructor() {
            console.log('=====商品编辑增强=====')
            this.init()
        }

        init() {
            const toolDiv = document.createElement('div')
            toolDiv.id = 'tool-div'
            toolDiv.style.width = '100%'
            toolDiv.style.height = '40px'
            // 添加按钮
            const showModalBtn = document.createElement('button')
            showModalBtn.innerText = '填充商品编码'
            showModalBtn.style.float = 'right'
            showModalBtn.style.zIndex = '9999'
            showModalBtn.style.padding = '5px 10px'
            showModalBtn.style.fontSize = '12px'
            showModalBtn.style.backgroundColor = '#4CAF50'
            showModalBtn.style.color = 'white'
            showModalBtn.style.border = 'none'
            showModalBtn.style.borderRadius = '5px'
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
            const fullScreenCard = document.querySelector('#full-screen-card') // 根据实际的目标元素选择器进行修改

            // 如果目标元素已经存在，直接插入子元素
            if (fullScreenCard) {
                fullScreenCard.prepend(toolDiv)
            } else {
                const intervalId = setInterval(() => {
                    console.log('Waiting for full-screen-card...')
                    const target = document.querySelector('#full-screen-card')
                    if (target) {
                        clearInterval(intervalId)  // 停止轮询
                        target.prepend(toolDiv)
                    }
                }, 1000)
            }

            showModalBtn.addEventListener('click', () => {
                showModalBtn.scrollIntoView({behavior: 'smooth', block: 'start'})
                //处理是否完成标记
                let isCompleted = false

                const skuColorEle = document.querySelector('#skuValue-颜色分类')
                const colorValues = Object.values(skuColorEle)[0].memoizedProps.children.props.form.value._value
                const colorMap = {}
                colorValues.forEach(colorValue => {
                    colorMap[colorValue.id] = colorValue.name
                })

                const skuSizeEle = document.querySelector('#skuValue-鞋码大小')
                const sizeValues = Object.values(skuSizeEle)[0].memoizedProps.children.props.form.value._value
                const sizeMap = {}
                sizeValues.forEach(sizeValue => {
                    sizeMap[sizeValue.id] = sizeValue.name
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
                <table style="width: 100%; margin-bottom: 20px; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th style="padding: 8px; border: 1px solid #ccc;">颜色分类</th>
                            <th style="padding: 8px; border: 1px solid #ccc;">前缀</th>
                            <th style="padding: 8px; border: 1px solid #ccc;">后缀</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.keys(colorMap).map(key => `
                            <tr>
                                <td style="padding: 8px; border: 1px solid #ccc;">${colorMap[key]}</td>
                                <td style="padding: 8px; border: 1px solid #ccc;">
                                    <input type="text" class="color-prefix" data-color="${colorMap[key]}" data-color-id="${key}" style="width: 100%; padding: 6px; border: 1px solid #ccc;" />
                                </td>
                                <td style="padding: 8px; border: 1px solid #ccc;">
                                    <input type="text" class="color-suffix" data-color="${colorMap[key]}" data-color-id="${key}" style="width: 100%; padding: 6px; border: 1px solid #ccc;" />
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <button id="submit-prefixes" style="padding: 10px 20px; font-size: 16px; background-color: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer;  float:right">
                <span id="btn-text">确定</span>
                <div id="loading-spinner" style="display: none; border: 3px solid white; border-top: 3px solid transparent; border-radius: 50%; width: 16px; height: 16px; animation: spin 1s linear infinite;"></div>
                </button>
                <button id="cancel-prefixes" style="padding: 10px 20px; font-size: 16px; background-color: #f44336; color: white; border: none; border-radius: 5px; cursor: pointer; margin-right: 10px;float:right">取消</button>
            </div>
        `
                document.body.appendChild(modal)
                const submitBtn = document.getElementById('submit-prefixes')
                // 确定按钮点击后处理输入的数据
                submitBtn.addEventListener('click', () => {
                    // 显示加载动画
                    document.getElementById('btn-text').style.display = 'none'
                    document.getElementById('loading-spinner').style.display = 'inline-block'
                    const prefixMap = {}
                    const suffixMap = {}
                    document.querySelectorAll('.color-prefix').forEach(input => {
                        prefixMap[input.getAttribute('data-color-id')] = input.value
                    })
                    document.querySelectorAll('.color-suffix').forEach(input => {
                        suffixMap[input.getAttribute('data-color-id')] = input.value
                    })
                    //颜色划分
                    const eTableEles = document.querySelectorAll('div.ecom-g-table-container')
                    let values = Object.values(eTableEles[0]);
                    //必须取第一个元素
                    const fiberNode = values[0]
                    fiberNode.memoizedProps.children.props.children[1].props.data.forEach(item => {
                        const colorId = item.form.value._value.spec_detail_ids[0]
                        const sizeId = item.form.value._value.spec_detail_ids[1]
                        // 获取用户输入的前缀
                        const prefix = prefixMap[colorId] || ''
                        const suffix = suffixMap[colorId] || ''
                        const size = sizeMap[sizeId]
                        if (size) {
                            if (prefix && prefix.length > 0) {
                                // 拼接前缀和鞋码大小
                                item.form.children.code.value._setter(prefix + size + suffix) // 填充商品编码
                            } else if (suffix && suffix.length > 0) {
                                const lastValue = item.form.children.code.value._value
                                item.form.children.code.value._setter(lastValue + suffix) // 填充商品编码
                            }
                        }
                    })
                    isCompleted = true

                    // 关闭弹窗
                    function checkCompleted() {
                        setTimeout(() => {
                            if (isCompleted) {
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

    if (location.href.includes('/ffa/g/create?')) {
        new ProductEditEnhance()
    }
    //==================商品编辑增强，自动填充商品编码 END=======/

})()
