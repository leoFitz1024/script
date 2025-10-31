// ==UserScript==
// @name         抖店增强工具箱
// @namespace    http://tampermonkey.net/
// @version      2.0.2
// @description  抖音小店后台功能增强
// @author       xchen
// @match        https://*.jinritemai.com/*
// @icon         https://lf1-fe.ecombdstatic.com/obj/eden-cn/upqphj/homepage/icon.svg
// @connect       www.erp321.com
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
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
        if (location.href.includes('ffa/content-tool/live/control?')) {
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

    /**
     * 监听指定元素下子元素的动态变化
     * @param {string|Element} target - 要监听的元素或选择器
     * @param {Function} callback - 变化时触发的回调函数
     * @param {Object} options - 配置选项
     * @returns {Function} 停止监听的函数
     */
    function observeElementChanges(target, options = {}, callback,) {
        const {
            childList = true,           // 监听子节点变化
            subtree = true,             // 监听所有后代节点
            attributes = false,         // 监听属性变化
            attributeFilter = null,     // 指定要监听的属性
            characterData = false,      // 监听文本内容变化
            debounce = 100,             // 防抖时间(ms)
            immediate = false,          // 是否立即执行一次回调
            autoStart = true            // 是否自动开始监听
        } = options;
        // 获取目标元素
        const element = typeof target === 'string'
            ? document.querySelector(target)
            : target;

        if (!element) {
            console.warn('Observe: 目标元素未找到', target);
            return () => {
            };
        }

        let mutationTimeout;
        let isObserving = false;

        // 防抖处理
        const debouncedCallback = (mutations, observer) => {
            clearTimeout(mutationTimeout);
            mutationTimeout = setTimeout(() => {
                callback(mutations, observer, element);
            }, debounce);
        };

        // 创建观察器
        const observer = new MutationObserver(debouncedCallback);

        // 观察器配置
        const observerConfig = {
            childList,
            subtree,
            attributes,
            characterData
        };

        if (attributes && attributeFilter) {
            observerConfig.attributeFilter = attributeFilter;
        }

        // 开始监听
        const start = () => {
            if (!isObserving) {
                observer.observe(element, observerConfig);
                isObserving = true;
                console.log('Observe: 开始监听元素变化', element);
            }
        };

        // 停止监听
        const stop = () => {
            if (isObserving) {
                observer.disconnect();
                clearTimeout(mutationTimeout);
                isObserving = false;
                console.log('Observe: 停止监听元素变化', element);
            }
        };

        // 重新开始监听
        const restart = () => {
            stop();
            start();
        };

        // 立即执行一次回调（如果需要）
        if (immediate) {
            setTimeout(() => callback([], observer, element), 0);
        }

        // 自动开始
        if (autoStart) {
            start();
        }

        // 返回控制方法
        return {
            stop,
            start: restart,
            restart,
            element,
            isObserving: () => isObserving
        };
    }

    function sendHttpRequest(method, url, headers = {}, data = null, callback) {
        // 设置请求的默认头部
        const defaultHeaders = {
            'Content-Type': 'application/json',  // 默认 Content-Type 为 application/json
            ...headers  // 合并用户传入的 headers
        };

        // 创建请求
        GM_xmlhttpRequest({
            method: method,  // 请求方法 ('GET' 或 'POST')
            url: url,  // 请求 URL
            headers: defaultHeaders,  // 请求头
            data: method === 'POST' || method === 'PUT' ? data : null,  // POST 请求时附带数据
            onload: function (response) {
                // 请求成功，调用回调函数并传入返回的响应数据
                if (response.status === 200) {
                    callback(null, response.responseText);
                } else {
                    console.log(response)
                    showMessage('error', `Request failed with status: ${response.status}`);
                }
            },
            onerror: function (error) {
                showMessage('error', `Request error: ${error}`);
            }
        });
    }

    // 6. **封装等待元素出现的方法**
    function waitForElementByXPath(xpath, timeout = 10000) {
        return new Promise((resolve, reject) => {
            // 先检查是否已经存在
            const element = document.evaluate(
                xpath, document, null,
                XPathResult.FIRST_ORDERED_NODE_TYPE, null
            ).singleNodeValue;

            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver(() => {
                const element = document.evaluate(
                    xpath, document, null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE, null
                ).singleNodeValue;

                if (element) {
                    observer.disconnect();
                    resolve(element);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`等待元素超时: ${xpath}`));
            }, timeout);
        });
    }

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
            this.stockEditPlugin()
        }


        // 更新商品列表
        updateProductMap(productListRes) {
            this.productMap.clear()
            for (let i = 0; i < productListRes.data.length; i++) {
                const product = productListRes.data[i]
                if (product.product_format_new && product.product_format_new[3171] && product.product_format_new[3171][0]) {
                    const code = product.product_format_new[3171][0]['name']
                    if (code) {
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

        stockEditPlugin() {

            // ecom-g-sp-icon sp-icon-parcel style_editIcon__cahfa

            // 等待指定XPath元素出现，最多等待5000毫秒
            waitForElementByXPath('//tbody[contains(@class, "ecom-g-table-tbody")]', 5000).then((element) => {
                element.addEventListener('click', function (event) {
                    // 检查是否是目标按钮
                    if (event.target.matches('svg.icon')) {
                        waitForElementByXPath("//div[@class='index_filterBox__xQbII']", 5000).then((filterBox) => {
                            let syncBtn = Object.assign(document.createElement('button'), {
                                innerText: '同步库存',
                                style: 'border-radius:8px;background:blue;color:white;padding:2px 16px;border:none;cursor:pointer;position:absolute;right:0px;'
                            });
                            filterBox.lastElementChild.appendChild(syncBtn)
                            syncBtn.addEventListener('click', () => {
                                syncStock()
                            })
                        })
                    }
                });
            })


            function syncStock() {
                console.log('同步库存')
                let elementById = document.getElementById("__ffa-goods-popup-container__");
                const eTableEles = elementById.querySelectorAll('div.ecom-g-table-container')
               
                let values = Object.values(eTableEles[0]);
                //必须取第一个元素
                const fiberNode = values[0]
                let dataList = fiberNode.memoizedProps.children.props.children[1].props.data
                let skuIds = new Set()
                dataList.forEach(datum => {
                    let fc = datum.tableInfo.fc;
                    let rowData = fc.getValue();
                    let code = rowData.code.replaceAll("=", "").replaceAll("+", "");
                    let codeFlag = code.substring(0, code.length - 4);
                    skuIds.add(codeFlag)
                })
                getStockFromErp(Array.from(skuIds)).then(stockMap => {
                    console.log(stockMap)
                    dataList.forEach(datum => {
                        let fc = datum.tableInfo.fc;
                        let header = datum.header;
                        let rowData = fc.getValue();
                        let code = rowData.code.replaceAll("=","").replaceAll("+", "");
                        if (header[2]['name'].includes("天内发货") || !stockMap.has(code)) {
                            console.log("不符合条件，跳过:", header[2]['name'], code)
                            return
                        }
                        let stockGetNum = stockMap.get(code);
                        if (stockGetNum < 0) {
                            stockGetNum = 0
                        }
                        let lastNum = rowData.num
                        rowData.num = stockGetNum + ''
                        fc.root.emit()
                        console.log(`skuId:${code}，更新库存:${lastNum}===》${stockGetNum}`)
                    })
                })
                console.log('现货库存更新完成')
            }

            function getStockFromErp(skuIds) {
                console.log("查询库存：", skuIds)
                return new Promise((resolve, reject) => {
                    let erp321CooKie = GM_getValue("erp321CooKie", "");
                    // 获取ERP321Cookie值，如果为空则不做处理
                    if (erp321CooKie === "") {

                    }
                    let skuStockMap = new Map()
                    let finishedCount = 0
                    for (let i = 0; i < skuIds.length; i++) {
                        let skuId = skuIds[i];
                        let callBackParam = {
                            "Method": "LoadDataToJSON",
                            "Args": ["1", `[{"k":"sku_id","v":"${skuId}","c":"like"}]`, "{}"]
                        }
                        let callBackParamStr = JSON.stringify(callBackParam);
                        let params = `__VIEWSTATE=%2FwEPDwUKMTkyMTExMDQ5NWRk9w9%2BBwzZIG166vk7VBNHl%2B9FDaU%3D&__VIEWSTATEGENERATOR=491FF2E7&sku_id=${skuId}&_jt_page_size=500&__CALLBACKID=JTable1&__CALLBACKPARAM=${encodeURIComponent(callBackParamStr)}`
                        erp321CooKie = " jt.pagesize=.FKFWY4._500; u_lastLoginType=ap; dkv=%7B%22pstorder_editor%22%3A%220%2C0%22%2C%22pstol_item%22%3A%220%2C0%22%7D; jt.pagesize=.FKFWY4._200; ckv=%7B%22setwarehouse_clearlc%22%3A%22default%22%2C%22warehouseScaleEnabled%22%3Afalse%7D; u_ssi=; u_drp=-1; jump_env=www; tmp_gray=1; jump_isgray=0; u_shop=-1; _gi=-302; _ati=8414220403918; j_d_3=7HNTBQKN7KIMT2HXFQ2CRDNZ2BTWLUZ4ROVLLRF7I3DXJWBMQRDIBRO7WXXXPL4LP2TOBUMQIT4EKDOTVJWIBZ7MHI; u_name=%e9%99%88%e7%8e%8b%e6%98%86; u_lid=18851191669; u_co_name=%e6%b8%a9%e5%b7%9e%e8%b4%b0%e9%9b%b6%e4%bc%8d%e8%b4%b8%e6%98%93%e6%9c%89%e9%99%90%e5%85%ac%e5%8f%b8; u_r=12%2c17%2c27%2c41%2c102%2c1002; u_id=19750842; u_co_id=10011834; u_env=www; 3AB9D23F7A4B3C9B=7HNTBQKN7KIMT2HXFQ2CRDNZ2BTWLUZ4ROVLLRF7I3DXJWBMQRDIBRO7WXXXPL4LP2TOBUMQIT4EKDOTVJWIBZ7MHI; u_json=%7b%22t%22%3a%222025-10-29+13%3a57%3a49%22%2c%22co_type%22%3a%22%e6%a0%87%e5%87%86%e5%95%86%e5%ae%b6%22%2c%22proxy%22%3anull%2c%22ug_id%22%3a%22%22%2c%22dbc%22%3a%221045%22%2c%22tt%22%3a%2237%22%2c%22apps%22%3a%221.4.150.152.168%22%2c%22pwd_valid%22%3a%220%22%2c%22ssi%22%3anull%2c%22sign%22%3a%224536127.6C49878D88AA4D42B6B3DC61203DDCFC%2c2f8b8f83b31f21e6c0e662af4eb82ae9%22%7d; v_d_144=1761717467880_fbafbc967d74fbdbff9f03352f725a69; u_cid=134061910693899917; u_sso_token=CS@096275146ee449fa91d0e68a14567375; p_50=ED62A8E3623E814178D22CB3DBF15F37638973430693906306%7c10011834; u_isTPWS=2; isLogin=false; acw_tc=1a0c66da17617337868395446e582b2d97ed553ba306193a1cb91641363521; tfstk=gNfmw2jXRtJfCFcjnPAbn3GTCd2RkIO6dGh9XCKaU3-SDmhA7fvN5FTwuNrfj1xygd6vXnKMsNs3ykFL9Z_X1BELvWUAAcj61hP9_8drOVYtIkFL9Zzj95RUvteRipY97C8qgjlzrELM_EJ23zxySeMZ0GRarzYBSEowuf7rUFLp_hSw_zbyVFAw7GRara-W7b8S_HfNN_r6JO-pPUlhWEvDYZ-PkZCyoDKFu3cZ_nYDn8Q2qflNZODmL3t4d4K6Mn_voGNIGIJGdNLGmScVjw15qUSUsXKVPwBphsPICpA2mdfVooVGr1xDLsJoSPQHGFSwITZn9EAAEpfchPiPuMKcLI_t-oQkKTvBzLui3IBdJ19FgSmB2pTGD3IUTbAyQg7qUv-GOfTzW_DsCK8WrHHPMHz1hO2fqz4od-92PEELrzDsCK8WrHUurvi63UTYv"
                        sendHttpRequest('POST', 'https://www.erp321.com/app/item/SkuStock/SkuStock.aspx?_c=jst-epaas&am___=LoadDataToJSON', {
                            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                            'Cookie': erp321CooKie
                        }, params, (err, res) => {
                            finishedCount++
                            if (err) {
                                console.error(err);
                                return;
                            }
                            console.log(res)
                            let resJsonStr = res.substring(2);
                            let resJson = JSON.parse(resJsonStr);
                            if (!resJson["IsSuccess"]) {

                            }
                            let dataJson = JSON.parse(resJson['ReturnValue']);
                            dataJson['datas'].forEach(skuData => {
                                // 可用库存 = 主仓库存 - 锁定库存 - 已下单库存 + 进货库存
                                let stockNum = skuData['qty'] - skuData['lock_qty'] - skuData['order_lock'] + skuData['in_qty']
                                skuStockMap.set(skuData['sku_id'], stockNum)
                            })
                            if (finishedCount === skuIds.length) {
                                console.log("sku库存查询完成")
                                resolve(skuStockMap)
                            }
                        })
                    }
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
            this.productCodePlugin()
        }

        productCodePlugin() {
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
                     //有时候是第二个表格
                    let values = Object.values(eTableEles[1]);
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

