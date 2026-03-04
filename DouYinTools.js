// ==UserScript==
// @name         抖店工具箱合并版-3.1.0
// @version      3.1.0
// @description  抖店增强工具箱 网页功能增强
// @author       xchen
// @match        https://*.jinritemai.com/*
// @icon         https://lf1-fe.ecombdstatic.com/obj/eden-cn/upqphj/homepage/icon.svg
// @updateURL    https://cdn.jsdmirror.com/gh/leoFitz1024/script@latest/DouYinTools.js
// @downloadURL  https://cdn.jsdmirror.com/gh/leoFitz1024/script@latest/DouYinTools.js
// @require      https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js
// @connect      www.erp321.com
// @connect      api.erp321.com
// @connect      open.feishu.cn
// @connect      fxg.jinritemai.com
// @connect      api.dingtalk.com
// @connect      oapi.dingtalk.com
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict'

    console.log('=============抖店工具箱合并版==============')
    /* =========================公共基础方法 类=========================== */

    // ========== 工具函数库 ==========
    const Utils = {
        /**
         * 发送HTTP请求
         */
        sendHttpRequest(method, url, headers = {}, data = null, withCredentials = false) {
            return new Promise((resolve, reject) => {
                const defaultHeaders = {
                    'Content-Type': 'application/json',
                    ...headers
                }

                // 根据 Content-Type 决定是否 JSON.stringify
                let requestData = null
                if (method === 'POST' || method === 'PUT') {
                    if (data !== null) {
                        const contentType = defaultHeaders['Content-Type'] || ''
                        if (contentType.includes('application/json') && typeof data === 'object') {
                            requestData = JSON.stringify(data)
                        } else {
                            requestData = data
                        }
                    }
                }
                // console.log(method, url, defaultHeaders, requestData)
                const requestOptions = {
                    method: method,
                    url: url,
                    headers: defaultHeaders,
                    data: requestData,
                    withCredentials: withCredentials,
                    onload: function (response) {
                        if (response.status === 200) {
                            resolve(response.responseText)
                        } else {
                            console.log(response)
                            UI.showMessage('error', `Request failed with status: ${response.status}`)
                            reject(new Error(`Request failed with status: ${response.status}`))
                        }
                    },
                    onerror: function (error) {
                        console.log(error)
                        UI.showMessage('error', `Request error: ${error.error}`)
                        reject(new Error(`Request error: ${error}`))
                    }
                }
                if (withCredentials) {
                    requestOptions.withCredentials = withCredentials
                }
                GM_xmlhttpRequest(requestOptions)
            })
        },
        /**
         * 发送XMLHttpRequest请求
         */
        request(url, options = {}) {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.open(options.method || "GET", url, true);

                if (options.withCredentials) {
                    xhr.withCredentials = true;
                }

                if (options.headers) {
                    Object.entries(options.headers).forEach(([k, v]) =>
                        xhr.setRequestHeader(k, v)
                    );
                }

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(xhr.responseText);
                    } else {
                        reject(new Error(`HTTP ${xhr.status}`));
                    }
                };

                xhr.onerror = () => reject(new Error("Network Error"));

                xhr.send(options.body || null);
            });
        },

        /**
         * 等待元素出现
         */
        waitForElementByXPath(xpath, timeout = 10000, context = document) {
            return new Promise((resolve, reject) => {
                const element = context.evaluate(
                    xpath, context, null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE, null
                ).singleNodeValue

                if (element) {
                    resolve(element)
                    return
                }

                let timeoutId = null
                let observer = null
                let checkInterval = null
                let isResolved = false

                const cleanup = () => {
                    if (timeoutId) {
                        clearTimeout(timeoutId)
                        timeoutId = null
                    }
                    if (observer) {
                        observer.disconnect()
                        observer = null
                    }
                    if (checkInterval) {
                        clearInterval(checkInterval)
                        checkInterval = null
                    }
                }

                const doReject = (error) => {
                    if (isResolved) return
                    isResolved = true
                    cleanup()
                    reject(error)
                }

                const doResolve = (element) => {
                    if (isResolved) return
                    isResolved = true
                    cleanup()
                    resolve(element)
                }

                // 获取要观察的目标节点，优先使用 body，如果不存在则使用 documentElement
                const getObserveTarget = () => {
                    if (document.body) {
                        return document.body
                    }
                    if (document.documentElement) {
                        return document.documentElement
                    }
                    return null
                }

                const startObserving = (target) => {
                    if (isResolved) return

                    observer = new MutationObserver(() => {
                        const element = document.evaluate(
                            xpath, document, null,
                            XPathResult.FIRST_ORDERED_NODE_TYPE, null
                        ).singleNodeValue

                        if (element) {
                            doResolve(element)
                        }
                    })

                    try {
                        observer.observe(target, {
                            childList: true,
                            subtree: true
                        })
                    } catch (error) {
                        console.warn(`观察目标节点时出错: ${error.message}`)
                        doReject(new Error(`无法观察目标节点: ${error.message}`))
                        return
                    }

                    // 设置超时 - 只有当timeout不为-1时才设置超时
                    if (timeout !== -1) {
                        timeoutId = setTimeout(() => {
                            console.warn(`等待元素超时: ${xpath}`)
                            doReject(new Error(`等待元素超时: ${xpath}`))
                        }, timeout)
                    }
                }

                const observeTarget = getObserveTarget()
                if (!observeTarget) {
                    // 如果目标节点不存在，等待 DOM 加载
                    checkInterval = setInterval(() => {
                        const target = getObserveTarget()
                        if (target) {
                            clearInterval(checkInterval)
                            checkInterval = null
                            startObserving(target)
                        }
                    }, 100)

                    // 设置超时（等待 DOM 加载）- 只有当timeout不为-1时才设置超时
                    if (timeout !== -1) {
                        timeoutId = setTimeout(() => {
                            console.warn(`等待元素超时: ${xpath} (DOM未加载)`);
                            doReject(new Error(`等待元素超时: ${xpath} (DOM未加载)`))
                        }, timeout)
                    }
                } else {
                    startObserving(observeTarget)
                }
            })
        },

        /**
        * 等待条件满足
        * @param conditionFn 条件函数，返回true时表示条件满足
        * @param options 配置项
        * @returns {Promise} 当条件满足时解析，超时或被拒绝时拒绝
        */
        waitFor(conditionFn, {
            interval = 300,   // 每次检查间隔(ms)
            timeout = 10000   // 超时时间(ms)
        } = {}) {
            return new Promise((resolve, reject) => {
                const start = Date.now();

                const timer = setInterval(() => {
                    if (conditionFn()) {
                        clearInterval(timer);
                        resolve(true);
                    } else if (Date.now() - start > timeout) {
                        clearInterval(timer);
                        reject(new Error('等待超时'));
                    }
                }, interval);
            });
        },

        /**
        * @param inputDom 输入框DOM 比如：document.getElementById('userId')
        * @newText 新的文本
        */
        changeReactInputValue(inputDom, newText) {
            let lastValue = inputDom.value;
            inputDom.value = newText;
            let event = new Event('input', { bubbles: true });
            event.simulated = true;
            let tracker = inputDom._valueTracker;
            if (tracker) {
                tracker.setValue(lastValue);
            }
            inputDom.dispatchEvent(event);
        },

        /**
         * 监听元素变化
         */
        observeElementChanges(target, options = {}, callback) {
            const {
                childList = true,
                subtree = true,
                attributes = false,
                attributeFilter = null,
                characterData = false,
                debounce = 100,
                immediate = false,
                autoStart = true,
                waitForElement = false,  // 新增：是否等待元素出现
                waitTimeout = 10000,     // 新增：等待超时时间
                waitInterval = 1000      // 新增：等待检查间隔
            } = options

            let element = typeof target === 'string' ? document.querySelector(target) : target
            let mutationTimeout
            let isObserving = false
            let waitIntervalId = null
            let observer = null

            const debouncedCallback = (mutations, observer) => {
                clearTimeout(mutationTimeout)
                mutationTimeout = setTimeout(() => {
                    callback(mutations, observer, element)
                }, debounce)
            }

            const createObserver = () => {
                if (observer) return observer

                observer = new MutationObserver(debouncedCallback)
                return observer
            }

            const startObserving = () => {
                if (!element || isObserving) return

                const observerConfig = {
                    childList,
                    subtree,
                    attributes,
                    characterData
                }

                if (attributes && attributeFilter) {
                    observerConfig.attributeFilter = attributeFilter
                }

                createObserver().observe(element, observerConfig)
                isObserving = true
                // console.log('Observe: 开始监听元素变化', element)
                console.log('Observe: 开始监听元素变化')
            }

            const stopObserving = () => {
                if (observer && isObserving) {
                    observer.disconnect()
                    clearTimeout(mutationTimeout)
                    isObserving = false
                    // console.log('Observe: 停止监听元素变化', element)
                    console.log('Observe: 停止监听元素变化')
                }
            }

            const waitForElementAndStart = () => {
                if (typeof target !== 'string') {
                    console.warn('Observe: waitForElement 选项需要字符串选择器', target)
                    return
                }

                let waitTime = 0
                waitIntervalId = setInterval(() => {
                    element = document.querySelector(target)
                    if (element) {
                        clearInterval(waitIntervalId)
                        waitIntervalId = null
                        console.log('Observe: 找到目标元素，开始监听', element)
                        startObserving()
                    } else if (waitTime >= waitTimeout) {
                        clearInterval(waitIntervalId)
                        waitIntervalId = null
                        console.warn('Observe: 等待元素超时', target)
                    } else {
                        waitTime += waitInterval
                    }
                }, waitInterval)
            }

            const start = () => {
                if (waitForElement && !element) {
                    waitForElementAndStart()
                } else if (element) {
                    startObserving()
                } else {
                    console.warn('Observe: 目标元素未找到', target)
                }
            }

            const stop = () => {
                if (waitIntervalId) {
                    clearInterval(waitIntervalId)
                    waitIntervalId = null
                }
                stopObserving()
            }

            const restart = () => {
                stop()
                start()
            }

            if (immediate && element) {
                setTimeout(() => callback([], observer, element), 0)
            }

            if (autoStart) {
                start()
            }

            return {
                stop,
                start: restart,
                restart,
                element: () => element,
                isObserving: () => isObserving
            }
        },

        /**
        * 通过XPath查找单个元素
        * @param {string} xpath - XPath表达式
        * @param {Element} [context=document] - 查找上下文，默认为整个文档
        * @returns {Element|null} - 找到的元素或null
        */
        getElementByXpath(xpath, context = document) {
            try {
                const result = document.evaluate(
                    xpath,
                    context,
                    null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                    null
                );
                return result.singleNodeValue;
            } catch (error) {
                console.error(`XPath查询错误: ${xpath}`, error);
                return null;
            }
        },

        /**
         * 通过XPath查找多个元素
         * @param {string} xpath - XPath表达式
         * @param {Element} [context=document] - 查找上下文
         * @returns {Element[]} - 找到的元素数组
         */
        getElementsByXpath(xpath, context = document) {
            try {
                const result = document.evaluate(
                    xpath,
                    context,
                    null,
                    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                    null
                );

                const elements = [];
                for (let i = 0; i < result.snapshotLength; i++) {
                    elements.push(result.snapshotItem(i));
                }
                return elements;
            } catch (error) {
                console.error(`XPath查询错误: ${xpath}`, error);
                return [];
            }
        },

        /**
         * 复制到剪贴板
         */
        copyToClipboard(text) {
            navigator.clipboard.writeText(text)
        },

        /**
         * 从URL获取查询参数
         */
        getQueryParam(url, paramName) {
            const urlObj = new URL(url)
            const params = new URLSearchParams(urlObj.search)
            return params.get(paramName)
        },

        /**
         * 数字格式化
         */
        formatNumber(num) {
            const [int, dec = ''] = num.toString().split('.')
            const result = int.length + dec.length <= 2 ?
                (dec ? `${int}.${dec}` : int) :
                (dec ? `${int}.${dec.substring(0, 2)}` : int)
            return Number(result)
        },

        /**
         * 转换为万单位字符串
         */
        convertToWanString(num) {
            if (num >= 10000) {
                return this.formatNumber(num / 10000) + '万'
            } else {
                return num.toString()
            }
        },

        /**
         * 转换为百分比字符串
         */
        covertToBaiFenString(num) {
            return this.formatNumber(num * 100) + '%'
        },

        /**
         * 获取范围平均值
         */
        getRangeAvg(rangeStr) {
            const numbers = String(rangeStr).match(/\d+/g).map(Number)
            return numbers.reduce((a, b) => a + b) / numbers.length
        },

        /**
         * 将万单位字符串转换为数字
         */
        convertToWanNumber(wanStr) {
            if (typeof wanStr === 'number') return wanStr
            if (typeof wanStr !== 'string') return 0
            if (wanStr.includes('万')) {
                return parseFloat(wanStr.replace('万', '')) * 10000
            }
            return parseFloat(wanStr) || 0
        },

        /**
         * 工具函数: 获取当前日期
         * @returns {string} YYYY/M/D格式
         */
        getCurrentDate() {
            const now = new Date()
            const year = now.getFullYear()
            const month = now.getMonth() + 1
            const day = now.getDate()
            return `${year}/${month}/${day}`
        },

        /**
         * 将时间戳格式化为中国时区的时间字符串
         * @param {number|string|Date} timestamp - 时间戳（毫秒）或Date对象
         * @param {string} format - 格式化模板，支持：YYYY(年), MM(月), DD(日), HH(时), mm(分), ss(秒), SSS(毫秒)
         * @returns {string} 格式化后的时间字符串
         * @example
         * Utils.formatTimestamp(1704067200000, 'YYYY-MM-DD HH:mm:ss') // '2024-01-01 08:00:00'
         * Utils.formatTimestamp(Date.now(), 'YYYY/MM/DD') // '2024/01/01'
         * Utils.formatTimestamp(Date.now(), 'HH:mm:ss.SSS') // '14:30:25.123'
         */
        formatTimestamp(timestamp, format = 'YYYY-MM-DD HH:mm:ss') {
            // 处理输入
            let date
            if (timestamp instanceof Date) {
                date = timestamp
            } else if (typeof timestamp === 'string') {
                date = new Date(Number(timestamp))
            } else if (typeof timestamp === 'number') {
                date = new Date(timestamp)
            } else {
                throw new Error('Invalid timestamp format')
            }

            // 转换为中国时区（东八区）
            const cnDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }))

            // 提取时间分量
            const year = cnDate.getFullYear()
            const month = String(cnDate.getMonth() + 1).padStart(2, '0')
            const day = String(cnDate.getDate()).padStart(2, '0')
            const hours = String(cnDate.getHours()).padStart(2, '0')
            const minutes = String(cnDate.getMinutes()).padStart(2, '0')
            const seconds = String(cnDate.getSeconds()).padStart(2, '0')
            const milliseconds = String(cnDate.getMilliseconds()).padStart(3, '0')

            // 格式化映射
            const formatMap = {
                'YYYY': year,
                'MM': month,
                'DD': day,
                'HH': hours,
                'mm': minutes,
                'ss': seconds,
                'SSS': milliseconds
            }

            // 替换格式模板
            return format.replace(/YYYY|MM|DD|HH|mm|ss|SSS/g, match => formatMap[match])
        },

        /**
         * 获取时间戳的各个部分（中国时区）
         * @param {number|string|Date} timestamp - 时间戳（毫秒）或Date对象，默认为当前时间
         * @returns {Object} 包含各时间部分的对象
         * @example
         * Utils.getTimestampParts(1704067200000)
         * // { year: '2024', yearShort: '24', month: '01', day: '01', hour: '08', minute: '00', second: '00' }
         */
        getTimestampParts(timestamp = Date.now()) {
            // 处理输入
            let date
            if (timestamp instanceof Date) {
                date = timestamp
            } else if (typeof timestamp === 'string') {
                date = new Date(Number(timestamp))
            } else if (typeof timestamp === 'number') {
                date = new Date(timestamp)
            } else {
                throw new Error('Invalid timestamp format')
            }

            // 转换为中国时区（东八区）
            const cnDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }))

            const year = cnDate.getFullYear()
            const month = cnDate.getMonth() + 1
            const day = cnDate.getDate()
            const hour = cnDate.getHours()
            const minute = cnDate.getMinutes()
            const second = cnDate.getSeconds()

            return {
                year: String(year),                    // 完整年份，如 '2024'
                yearShort: String(year).slice(-2),     // 年份后两位，如 '24'
                month: String(month), // 月份，如 '1'
                day: String(day),     // 日期，如 '01'
                hour: String(hour),   // 小时，如 '08'
                minute: String(minute), // 分钟，如 '00'
                second: String(second)  // 秒，如 '00'
            }
        },

        /**
         * 将秒数转换为时长字符串
         * @param {number} seconds - 秒数
         * @param {Object} options - 配置选项
         * @param {boolean} options.showSeconds - 是否显示秒，默认为false
         * @param {string} options.hourUnit - 小时单位，默认为'小时'
         * @param {string} options.minuteUnit - 分钟单位，默认为'分'
         * @param {string} options.secondUnit - 秒单位，默认为'秒'
         * @returns {string} 时长字符串，如 '3小时15分' 或 '3小时15分30秒'
         * @example
         * Utils.formatDuration(11730) // '3小时15分'
         * Utils.formatDuration(11730, { showSeconds: true }) // '3小时15分30秒'
         * Utils.formatDuration(45) // '0分45秒' (当showSeconds为true时)
         * Utils.formatDuration(3661, { hourUnit: 'h', minuteUnit: 'm', secondUnit: 's' }) // '1h1m1s'
         */
        formatDuration(seconds, options = {}) {
            // 参数校验
            if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
                throw new Error('seconds must be a non-negative number')
            }

            const {
                showSeconds = false,
                hourUnit = '小时',
                minuteUnit = '分',
                secondUnit = '秒'
            } = options

            // 计算时分秒
            const hours = Math.floor(seconds / 3600)
            const minutes = Math.floor((seconds % 3600) / 60)
            const secs = Math.floor(seconds % 60)

            // 构建结果字符串
            let result = ''

            // 添加小时部分（如果有小时或需要显示0小时）
            if (hours > 0 || (minutes === 0 && secs === 0 && !showSeconds)) {
                result += `${hours}${hourUnit}`
            }

            // 添加分钟部分
            if (minutes > 0 || hours > 0 || (secs === 0 && !showSeconds)) {
                result += `${minutes}${minuteUnit}`
            }

            // 添加秒部分（如果showSeconds为true）
            if (showSeconds) {
                result += `${secs}${secondUnit}`
            }

            // 如果结果为空（seconds为0且showSeconds为false），返回0分
            if (result === '') {
                result = `0${minuteUnit}`
            }

            return result
        },

        /**
        * 截图元素（移除指定ID元素）
        * @param {Element} targetEl - 目标元素
        * @param {string[]} removeIds - 要移除的元素ID数组
        * @param {Object} stylePatch - 样式补丁对象，键为选择器，值为样式对象
        * @returns {Promise<HTMLCanvasElement>} - 截图Canvas元素
        * @description 截图目标元素，移除指定ID元素，同时应用样式补丁
        */
        async captureWithoutIds(
            targetEl,
            removeIds = [],
            stylePatch = {}
        ) {
            const canvas = await html2canvas(targetEl, {
                logging: false,
                useCORS: true,
                scale: 1,
                onclone: (clonedDoc) => {
                    // 1️⃣ 移除指定 ID
                    removeIds.forEach(id => {
                        const el = clonedDoc.getElementById(id);
                        if (el) el.remove();
                    });

                    // 2️⃣ 应用样式补丁
                    Object.entries(stylePatch).forEach(([selector, styles]) => {
                        clonedDoc.querySelectorAll(selector).forEach(el => {
                            Object.entries(styles).forEach(([prop, value]) => {
                                el.style[prop] = value;
                            });
                        });
                    });
                }
            });

            return canvas;
        },

        /**
         * 将HTML字符串渲染截图转换为Blob对象
         * @param {string} htmlString - 要转换的HTML字符串
         * @param {Object} options - 配置选项
         * @param {number} options.width - 截图宽度，默认为2000
         * @param {number} options.scale - 缩放比例，默认为2
         * @param {string} options.backgroundColor - 背景颜色，默认为"#ffffff"
         * @returns {Promise<Blob>} - 转换后的Blob对象
         * @description 将HTML字符串包装成完整HTML，包含样式，转换为SVG，再加载为图片，最后转换为Blob对象
         */
        async captureHtmlToBlob(htmlString, options = {}) {
            const {
                width = 2000,
                scale = 2,
                backgroundColor = "#ffffff"
            } = options

            // 1️⃣ 创建隐藏 iframe
            const iframe = document.createElement("iframe")
            iframe.style.position = "fixed"
            iframe.style.left = "-10000px"
            iframe.style.top = "0"
            iframe.style.width = width + "px"
            iframe.style.height = "1px"
            iframe.style.visibility = "hidden"

            document.body.appendChild(iframe)

            // 2️⃣ 写入 HTML
            const doc = iframe.contentDocument
            doc.open()
            doc.write(htmlString)
            doc.close()

            // 3️⃣ 等待渲染完成
            await new Promise(resolve => {
                iframe.onload = resolve
            })

            // 再等一帧，确保布局完成
            await new Promise(r => requestAnimationFrame(r))

            // 4️⃣ 获取真实高度
            const body = iframe.contentDocument.body
            const height = body.scrollHeight

            iframe.style.height = height + "px"

            // 5️⃣ 使用 html2canvas 截图
            const canvas = await html2canvas(body, {
                useCORS: true,
                backgroundColor,
                scale,
                windowWidth: width,
                windowHeight: height
            })

            // 6️⃣ 转 Blob
            const blob = await new Promise(resolve =>
                canvas.toBlob(resolve, "image/png")
            )

            // 7️⃣ 清理
            document.body.removeChild(iframe)

            return blob
        },

        /**
         * 等待指定时间
         * @param {number} ms - 等待时间（毫秒）
         * @returns {Promise<void>}
         * @example
         * await Utils.sleep(1000) // 等待1秒
         */
        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms))
        }
    }

    // ========== UI组件库 ==========
    const UI = {
        /**
         * 显示消息提示
         */
        showMessage(type, message) {
            const popup = document.createElement('div')
            popup.style.position = 'fixed'
            popup.style.top = '50px'
            popup.style.right = '30px'
            popup.style.backgroundColor = type === 'error' ? '#f44336' : '#4CAF50'
            popup.style.color = 'white'
            popup.style.padding = '15px'
            popup.style.borderRadius = '5px'
            popup.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)'
            popup.style.zIndex = '9999999999'
            popup.innerText = message

            document.body.appendChild(popup)

            setTimeout(() => {
                popup.remove()
            }, 3000)
        },

        /**
         * 添加悬浮按钮
         */
        addFloatingButton(params) {
            const button = document.createElement('button')
            button.innerText = params.text
            // 合并样式
            button.id = params.id || 'floating-button'
            button.style.position = 'fixed'
            button.style.bottom = '30px'
            button.style.right = '30px'
            button.style.padding = '10px 20px'
            button.style.backgroundColor = '#007BFF'
            button.style.color = 'white'
            button.style.border = 'none'
            button.style.borderRadius = '5px'
            button.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)'
            button.style.cursor = 'pointer'
            button.style.fontSize = '16px'
            button.style.zIndex = '10000'
            Object.assign(button.style, params.style)
            //等待网页加载完成
            button.addEventListener('click', params.onClick)
            try {
                document.body.appendChild(button)
            } catch (error) {
                window.addEventListener('load', () => {
                    document.body.appendChild(button)
                })
            }
            return button
        },

        /**
         * 显示 HTML 预览弹窗
         * @param {string} htmlString - 要预览的 HTML 字符串
         * @param {string} buttonText - 确认按钮文本
         * @param {function} onAction - 确认操作回调
         */
        showHtmlPreviewModal(htmlString, buttonText = "执行操作", onAction) {
            const old = document.getElementById("html-preview-overlay")
            if (old) old.remove()

            const originalOverflow = document.body.style.overflow
            document.body.style.overflow = "hidden"

            const overlay = document.createElement("div")
            overlay.id = "html-preview-overlay"
            Object.assign(overlay.style, {
                position: "fixed",
                inset: "0",
                background: "rgba(0,0,0,0.6)",
                zIndex: "999999",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
            })

            const modal = document.createElement("div")
            Object.assign(modal.style, {
                width: "90vw",
                height: "90vh",
                background: "#fff",
                borderRadius: "12px",
                overflow: "hidden",
                position: "relative",
                boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                display: "flex",
                flexDirection: "column"
            })

            function closeModal() {
                overlay.remove()
                document.body.style.overflow = originalOverflow
                document.removeEventListener("keydown", escHandler)
            }

            function escHandler(e) {
                if (e.key === "Escape") {
                    closeModal()
                }
            }
            document.addEventListener("keydown", escHandler)

            const closeBtn = document.createElement("button")
            closeBtn.innerText = "✕"
            Object.assign(closeBtn.style, {
                position: "absolute",
                top: "10px",
                right: "10px",
                zIndex: "10",
                background: "#000",
                color: "#fff",
                border: "none",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                cursor: "pointer"
            })
            closeBtn.onclick = closeModal

            const iframe = document.createElement("iframe")
            Object.assign(iframe.style, {
                flex: "1",
                width: "100%",
                border: "none"
            })
            iframe.srcdoc = htmlString

            const footer = document.createElement("div")
            Object.assign(footer.style, {
                padding: "12px",
                borderTop: "1px solid #eee",
                display: "flex",
                justifyContent: "flex-end"
            })

            const actionBtn = document.createElement("button")
            actionBtn.innerText = buttonText
            Object.assign(actionBtn.style, {
                padding: "8px 16px",
                background: "#1677ff",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px"
            })

            // ===== 创建 spinner =====
            const spinner = document.createElement("span")
            Object.assign(spinner.style, {
                width: "14px",
                height: "14px",
                border: "2px solid #fff",
                borderTopColor: "transparent",
                borderRadius: "50%",
                display: "none",
                animation: "modal-spin 0.8s linear infinite"
            })

            // 注入动画
            const style = document.createElement("style")
            style.innerHTML = `
    @keyframes modal-spin {
      to { transform: rotate(360deg); }
    }
  `
            document.head.appendChild(style)

            actionBtn.appendChild(spinner)

            function setLoading(loading) {
                if (loading) {
                    spinner.style.display = "inline-block"
                    actionBtn.disabled = true
                    actionBtn.style.opacity = "0.7"
                    actionBtn.style.cursor = "not-allowed"
                } else {
                    spinner.style.display = "none"
                    actionBtn.disabled = false
                    actionBtn.style.opacity = "1"
                    actionBtn.style.cursor = "pointer"
                }
            }

            actionBtn.onclick = () => {
                if (typeof onAction === "function") {
                    setLoading(true)

                    onAction({
                        iframe,
                        close: closeModal,
                        done: () => setLoading(false),
                        setLoading
                    })
                }
            }

            footer.appendChild(actionBtn)

            modal.appendChild(closeBtn)
            modal.appendChild(iframe)
            modal.appendChild(footer)
            overlay.appendChild(modal)
            document.body.appendChild(overlay)

            overlay.addEventListener("click", (e) => {
                if (e.target === overlay) {
                    closeModal()
                }
            })
        }

    }

    // ========== 飞书文档操作 ==========
    /**
     * 钉钉 SDK（Tampermonkey 版）
     * 适用场景：
     * - 油猴脚本环境，跨域请求使用 GM_xmlhttpRequest
     * - accessToken 通过 GM 存储缓存，避免频繁获取
     * - 只对服务器异常/网络错误自动重试（5xx / network）
     */

    const DingTalkSDK = {
        // 基础配置，可在 init 时覆盖
        config: {
            APP_KEY: '',
            APP_SECRET: '',
            OPERATOR_ID: '',
            BASE_URL: 'https://api.dingtalk.com',
            CUSTOM_ROBOT_URL: 'https://oapi.dingtalk.com/robot/send',
            // 提前刷新 token 的缓冲时间
            TOKEN_EXPIRE_BUFFER_MS: 60 * 1000,
            // 自动重试配置（仅对可重试错误生效）
            RETRY: {
                maxRetries: 2,
                baseDelayMs: 500,
                maxDelayMs: 5000,
                jitter: 0.2
            }
        },

        // 内存级缓存
        _tokenCache: null,
        _tokenExpireAt: 0,
        // 并发请求时复用同一个 token 请求
        _tokenPromise: null,

        /**
         * 参数校验工具函数
         * @param {string} paramName - 参数名称
         * @param {*} paramValue - 参数值
         * @param {string} [type='string'] - 参数类型
         * @throws {Error} 参数校验失败时抛出错误
         */
        _validateParam(paramName, paramValue, type = 'string') {
            // 检查是否为 null 或 undefined
            if (paramValue === null || paramValue === undefined) {
                throw new Error(`参数 ${paramName} 不能为 null 或 undefined`);
            }

            // 检查是否为字符串类型
            if (type === 'string') {
                // 检查是否为字符串
                if (typeof paramValue !== 'string') {
                    throw new Error(`参数 ${paramName} 必须是字符串类型`);
                }
                // 检查是否为空字符串或仅包含空白字符
                if (paramValue.trim() === '') {
                    throw new Error(`参数 ${paramName} 不能为空字符串`);
                }
            }

            // 检查是否为数字类型
            if (type === 'number') {
                if (typeof paramValue !== 'number' || !Number.isFinite(paramValue)) {
                    throw new Error(`参数 ${paramName} 必须是有效的数字`);
                }
            }

            // 检查是否为对象类型
            if (type === 'object') {
                if (typeof paramValue !== 'object' || paramValue === null) {
                    throw new Error(`参数 ${paramName} 必须是对象类型`);
                }
            }
        },

        /**
         * 初始化 SDK
         * @param {string} appKey
         * @param {string} appSecret
         * @param {object} options - 覆盖默认配置
         */
        init(appKey, appSecret, operatorId, options = {}) {
            this._validateParam('appKey', appKey);
            this._validateParam('appSecret', appSecret);
            this._validateParam('operatorId', operatorId);
            this.config.APP_KEY = appKey;
            this.config.APP_SECRET = appSecret;
            this.config.OPERATOR_ID = operatorId;
            Object.assign(this.config, options);
            console.log('DingTalkSDK initialized successfully');
        },

        /**
         * 获取 accessToken（带缓存）
         * @param {boolean} forceRefresh - 是否强制刷新
         */
        async getAccessToken(forceRefresh = false) {
            if (!this.config.APP_KEY || !this.config.APP_SECRET) {
                throw new Error('APP_KEY/APP_SECRET is required.');
            }

            const now = Date.now();
            // 未强制刷新时优先走缓存
            if (!forceRefresh) {
                const cached = this._getCachedToken();
                if (cached && cached.token && cached.expireAt > now + this.config.TOKEN_EXPIRE_BUFFER_MS) {
                    return cached.token;
                }
            }

            if (this._tokenPromise) {
                return this._tokenPromise;
            }

            // 并发请求时复用同一条 token 请求
            this._tokenPromise = (async () => {
                const url = `${this.config.BASE_URL}/v1.0/oauth2/accessToken`;
                const body = {
                    appKey: this.config.APP_KEY,
                    appSecret: this.config.APP_SECRET
                };

                const data = await this._request('POST', url, {
                    headers: { 'Content-Type': 'application/json' },
                    body,
                    needAuth: false
                });
                if (!data || !data.accessToken) {
                    throw new Error('Failed to get accessToken.');
                }

                // 按官方返回的 expireIn 计算过期时间
                const expireIn = Number(data.expireIn || 0);
                const expireAt = Date.now() + expireIn * 1000;
                this._setCachedToken(data.accessToken, expireAt);
                return data.accessToken;
            })();

            try {
                return await this._tokenPromise;
            } finally {
                this._tokenPromise = null;
            }
        },

        clearTokenCache() {
            this._tokenCache = null;
            this._tokenExpireAt = 0;
            this._removeStore(this._tokenStorageKey());
        },

        // ------------------------
        // Doc Workbooks - Sheets
        // ------------------------
        /**
         * 获取所有工作表
         */
        async getSheets(workbookId, operatorId = this.config.OPERATOR_ID) {
            this._validateParam('workbookId', workbookId);
            this._validateParam('operatorId', operatorId);
            const path = `/v1.0/doc/workbooks/${encodeURIComponent(workbookId)}/sheets`;
            return this._requestAuthed('GET', path, { operatorId });
        },

        /**
         * 通过sheet名称获取sheetId
         * @param {string} workbookId - 工作簿ID
         * @param {string} sheetName - sheet名称
         * @param {string} operatorId - 操作者ID，默认为配置中的OPERATOR_ID
         * @returns {Promise<string|null>} - 返回sheetId，未找到返回null
         * @example
         * const sheetId = await DingTalkSDK.getSheetIdByName('workbookId123', 'Sheet1');
         * if (sheetId) {
         *     console.log('Sheet ID:', sheetId);
         * } else {
         *     console.log('Sheet not found');
         * }
         */
        async getSheetIdByName(workbookId, sheetName, operatorId = this.config.OPERATOR_ID) {
            this._validateParam('workbookId', workbookId);
            this._validateParam('sheetName', sheetName);
            this._validateParam('operatorId', operatorId);
            try {
                const result = await this.getSheets(workbookId, operatorId);

                // 钉钉API返回的数据结构：{ "value": [{ "id": "stxxxx", "name": "Sheet1" }] }
                const sheets = result?.value || [];

                if (!Array.isArray(sheets)) {
                    console.warn('获取sheet列表返回格式异常:', result);
                    return null;
                }

                // 查找匹配的sheet
                const sheet = sheets.find(s => s.name === sheetName);

                if (sheet) {
                    return sheet.id;
                }

                return null;
            } catch (error) {
                console.error('通过名称获取sheetId失败:', error);
                throw error;
            }
        },

        /**
         * 获取单个工作表属性
         */
        async getSheet(workbookId, sheetId, operatorId = this.config.OPERATOR_ID) {
            this._validateParam('workbookId', workbookId);
            this._validateParam('sheetId', sheetId);
            this._validateParam('operatorId', operatorId);
            const path = `/v1.0/doc/workbooks/${encodeURIComponent(workbookId)}/sheets/${encodeURIComponent(sheetId)}`;
            return this._requestAuthed('GET', path, { operatorId });
        },

        /**
         * 创建工作表
         */
        async createSheet(workbookId, name, operatorId = this.config.OPERATOR_ID) {
            this._validateParam('workbookId', workbookId);
            this._validateParam('name', name);
            this._validateParam('operatorId', operatorId);
            const path = `/v1.0/doc/workbooks/${encodeURIComponent(workbookId)}/sheets`;
            return this._requestAuthed('POST', path, { operatorId }, { name });
        },

        /**
         * 删除工作表
         */
        async deleteSheet(workbookId, sheetId, operatorId = this.config.OPERATOR_ID) {
            this._validateParam('workbookId', workbookId);
            this._validateParam('sheetId', sheetId);
            this._validateParam('operatorId', operatorId);
            const path = `/v1.0/doc/workbooks/${encodeURIComponent(workbookId)}/sheets/${encodeURIComponent(sheetId)}`;
            return this._requestAuthed('DELETE', path, { operatorId });
        },

        // ------------------------
        // Row/Column Operations
        // ------------------------
        /**
         * 在指定行上方插入行
         */
        async insertRowsBefore(workbookId, sheetId, row, rowCount, operatorId = this.config.OPERATOR_ID) {
            this._validateParam('workbookId', workbookId);
            this._validateParam('sheetId', sheetId);
            this._validateParam('row', row, 'number');
            this._validateParam('rowCount', rowCount, 'number');
            this._validateParam('operatorId', operatorId);
            const path = `/v1.0/doc/workbooks/${encodeURIComponent(workbookId)}/sheets/${encodeURIComponent(sheetId)}/insertRowsBefore`;
            return this._requestAuthed('POST', path, { operatorId }, { row, rowCount });
        },

        /**
         * 在指定列左侧插入列
         */
        async insertColumnsBefore(workbookId, sheetId, column, columnCount, operatorId = this.config.OPERATOR_ID) {
            this._validateParam('workbookId', workbookId);
            this._validateParam('sheetId', sheetId);
            this._validateParam('column', column, 'number');
            this._validateParam('columnCount', columnCount, 'number');
            this._validateParam('operatorId', operatorId);
            const path = `/v1.0/doc/workbooks/${encodeURIComponent(workbookId)}/sheets/${encodeURIComponent(sheetId)}/insertColumnsBefore`;
            return this._requestAuthed('POST', path, { operatorId }, { column, columnCount });
        },

        /**
         * 删除行
         */
        async deleteRows(workbookId, sheetId, row, rowCount, operatorId = this.config.OPERATOR_ID) {
            this._validateParam('workbookId', workbookId);
            this._validateParam('sheetId', sheetId);
            this._validateParam('row', row, 'number');
            this._validateParam('rowCount', rowCount, 'number');
            this._validateParam('operatorId', operatorId);
            const path = `/v1.0/doc/workbooks/${encodeURIComponent(workbookId)}/sheets/${encodeURIComponent(sheetId)}/deleteRows`;
            return this._requestAuthed('POST', path, { operatorId }, { row, rowCount });
        },

        /**
         * 删除列
         */
        async deleteColumns(workbookId, sheetId, column, columnCount, operatorId = this.config.OPERATOR_ID) {
            this._validateParam('workbookId', workbookId);
            this._validateParam('sheetId', sheetId);
            this._validateParam('column', column, 'number');
            this._validateParam('columnCount', columnCount, 'number');
            this._validateParam('operatorId', operatorId);
            const path = `/v1.0/doc/workbooks/${encodeURIComponent(workbookId)}/sheets/${encodeURIComponent(sheetId)}/deleteColumns`;
            return this._requestAuthed('POST', path, { operatorId }, { column, columnCount });
        },

        // ------------------------
        // Range Operations
        // ------------------------
        /**
         * 获取单元格区域内容/样式
         */
        async getRange(workbookId, sheetId, rangeAddress, select, operatorId = this.config.OPERATOR_ID) {
            this._validateParam('workbookId', workbookId);
            this._validateParam('sheetId', sheetId);
            this._validateParam('rangeAddress', rangeAddress);
            this._validateParam('operatorId', operatorId);
            const path = `/v1.0/doc/workbooks/${encodeURIComponent(workbookId)}/sheets/${encodeURIComponent(sheetId)}/ranges/${encodeURIComponent(rangeAddress)}`;
            const query = { operatorId };
            if (select) query.select = select;
            return this._requestAuthed('GET', path, query);
        },

        /**
         * 更新单元格区域
         */
        async updateRange(workbookId, sheetId, rangeAddress, payload, operatorId = this.config.OPERATOR_ID) {
            this._validateParam('workbookId', workbookId);
            this._validateParam('sheetId', sheetId);
            this._validateParam('rangeAddress', rangeAddress);
            this._validateParam('payload', payload, 'object');
            this._validateParam('operatorId', operatorId);
            const path = `/v1.0/doc/workbooks/${encodeURIComponent(workbookId)}/sheets/${encodeURIComponent(sheetId)}/ranges/${encodeURIComponent(rangeAddress)}`;
            return this._requestAuthed('PUT', path, { operatorId }, payload);
        },

        /**
         * 清除单元格区域数据（保留格式）
         */
        async clearRangeData(workbookId, sheetId, rangeAddress, operatorId = this.config.OPERATOR_ID) {
            this._validateParam('workbookId', workbookId);
            this._validateParam('sheetId', sheetId);
            this._validateParam('rangeAddress', rangeAddress);
            this._validateParam('operatorId', operatorId);
            const path = `/v1.0/doc/workbooks/${encodeURIComponent(workbookId)}/sheets/${encodeURIComponent(sheetId)}/ranges/${encodeURIComponent(rangeAddress)}/clearData`;
            return this._requestAuthed('POST', path, { operatorId });
        },

        /**
         * 清除单元格区域所有内容（含格式）
         */
        async clearRangeAll(workbookId, sheetId, rangeAddress, operatorId = this.config.OPERATOR_ID) {
            this._validateParam('workbookId', workbookId);
            this._validateParam('sheetId', sheetId);
            this._validateParam('rangeAddress', rangeAddress);
            this._validateParam('operatorId', operatorId);
            const path = `/v1.0/doc/workbooks/${encodeURIComponent(workbookId)}/sheets/${encodeURIComponent(sheetId)}/ranges/${encodeURIComponent(rangeAddress)}/clear`;
            return this._requestAuthed('POST', path, { operatorId });
        },

        /**
         * 合并单元格
         * merge_type: 合并类型，可选值：
                - "mergeAll": 全部合并（默认）
                - "mergeRows": 按行合并
                - "mergeColumns": 按列合并
                - "unmerge": 取消合并
         */
        async mergeRange(workbookId, sheetId, rangeAddress, mergeType = 'mergeAll', operatorId = this.config.OPERATOR_ID) {
            this._validateParam('workbookId', workbookId);
            this._validateParam('sheetId', sheetId);
            this._validateParam('rangeAddress', rangeAddress);
            this._validateParam('operatorId', operatorId);
            const path = `/v1.0/doc/workbooks/${encodeURIComponent(workbookId)}/sheets/${encodeURIComponent(sheetId)}/ranges/${encodeURIComponent(rangeAddress)}/merge`;
            return this._requestAuthed('POST', path, { operatorId, mergeType });
        },


        /**
         * 在指定列查找指定值所在的行号（1-based）
         * - 每次读取 batchSize 行（默认 200）
         * - 未找到目标值时，返回“最下方空白行”的行号
         * - 连续出现 maxEmptyRows 个空白行时判定数据结束
         * 说明：
         * 1) column 支持列字母（如 "A"）或 0-based 列索引（如 0 表示 A 列）
         * 2) 空白判断：null/undefined/空字符串/仅空白字符均视为“空”
         * 3) 返回的行号为 A1 记法对应的行号（1-based）
         */
        async findRowByColumnValue(workbookId, sheetId, column, targetValue, options = {}) {
            this._validateParam('workbookId', workbookId);
            this._validateParam('sheetId', sheetId);
            this._validateParam('column', column);
            this._validateParam('targetValue', targetValue);

            const batchSize = Number(options.batchSize || 200);
            const maxEmptyRows = Number(options.maxEmptyRows || 10);
            const startRow = Number(options.startRow || 1);
            const format = (options.format || 'raw').toLowerCase();

            if (!Number.isFinite(batchSize) || batchSize <= 0) {
                throw new Error('batchSize must be a positive number.');
            }
            if (!Number.isFinite(maxEmptyRows) || maxEmptyRows <= 0) {
                throw new Error('maxEmptyRows must be a positive number.');
            }
            if (!Number.isFinite(startRow) || startRow <= 0) {
                throw new Error('startRow must be a positive number (1-based).');
            }

            const columnLetter = this._normalizeColumnLetter(column);
            let currentRow = startRow;
            let consecutiveEmpty = 0;

            while (true) {
                const endRow = currentRow + batchSize - 1;
                const rangeAddress = `${columnLetter}${currentRow}:${columnLetter}${endRow}`;
                const result = await this.getRange(workbookId, sheetId, rangeAddress, 'values');
                const values = result && result.values ? result.values : [];

                // 遍历本批次每一行（即使 API 未返回，也按空白处理）
                for (let i = 0; i < batchSize; i += 1) {
                    const rowIndex = currentRow + i; // 1-based
                    const rowArray = values[i] || [];
                    const cellValue = rowArray[0];
                    const formattedCell = this._formatCellValue(cellValue, format);
                    const cellText = formattedCell === null || formattedCell === undefined ? '' : String(formattedCell);
                    const isEmpty = cellText.trim() === '';
                    if (!isEmpty) {
                        consecutiveEmpty = 0;
                        if (cellText === targetValue) {
                            return { rowIndex, find: true };
                        }
                    } else {
                        consecutiveEmpty += 1;
                        if (consecutiveEmpty >= maxEmptyRows) {
                            // 返回“最下方空白行”的行号（即这段空白的起始行）
                            return { rowIndex: rowIndex - maxEmptyRows + 1, find: false };
                        }
                    }
                }

                currentRow += batchSize;
            }
        },
        // ------------------------
        // Robot Messages
        // ------------------------
        /**
         * 人与人会话发送机器人消息
         */
        async sendPrivateChatMessage(payload) {
            this._validateParam('payload', payload, 'object');
            const path = `/v1.0/robot/privateChatMessages/send`;
            const body = this._normalizeRobotPayload(payload);
            return this._requestAuthed('POST', path, null, body);
        },

        /**
         * 批量发送人与机器人单聊消息
         */
        async batchSendOToMessages(payload) {
            this._validateParam('payload', payload, 'object');
            const path = `/v1.0/robot/oToMessages/batchSend`;
            const body = this._normalizeRobotPayload(payload);
            return this._requestAuthed('POST', path, null, body);
        },

        /**
         * 发送群聊机器人消息
         */
        async sendGroupMessage(payload) {
            this._validateParam('payload', payload, 'object');
            payload.robotCode = this.config.APP_KEY;
            const path = `/v1.0/robot/groupMessages/send`;
            const body = this._normalizeRobotPayload(payload);
            return this._requestAuthed('POST', path, null, body);
        },

        // 自定义机器人（旧版接口）
        async sendCustomRobotMessage(accessToken, messageBody, options = {}) {
            this._validateParam('accessToken', accessToken);
            this._validateParam('messageBody', messageBody, 'object');
            const query = new URLSearchParams({ access_token: accessToken });
            if (options.timestamp) query.append('timestamp', String(options.timestamp));
            if (options.sign) query.append('sign', String(options.sign));
            const url = `${this.config.CUSTOM_ROBOT_URL}?${query.toString()}`;
            return this._request('POST', url, {
                headers: { 'Content-Type': 'application/json' },
                body: messageBody,
                needAuth: false
            });
        },

        // ------------------------
        // Media Upload
        // ------------------------
        /**
         * 上传媒体文件（旧版接口）
         * @param {string} type - 媒体文件类型：image(图片)、voice(语音)、video(视频)、file(普通文件)
         * @param {Blob|ArrayBuffer|Uint8Array} fileData - 文件数据
         * @param {string} filename - 文件名
         * @returns {Promise<Object>} - 返回包含media_id的对象
         * @example
         * // 上传图片
         * const result = await DingTalkSDK.uploadMedia('image', imageBlob, 'image.jpg');
         * console.log(result.media_id);
         *
         * // 上传文件
         * const result = await DingTalkSDK.uploadMedia('file', fileBuffer, 'document.pdf');
         * console.log(result.media_id);
         */
        async uploadMedia(type, fileData, filename) {
            // 参数校验
            if (!type || typeof type !== 'string') {
                throw new Error('type must be a non-empty string');
            }
            const validTypes = ['image', 'voice', 'video', 'file'];
            if (!validTypes.includes(type)) {
                throw new Error(`type must be one of: ${validTypes.join(', ')}`);
            }
            if (!fileData) {
                throw new Error('fileData is required');
            }
            if (!filename || typeof filename !== 'string') {
                throw new Error('filename must be a non-empty string');
            }

            // 获取access_token
            const accessToken = await this.getAccessToken();

            // 构建URL（旧版接口使用oapi.dingtalk.com）
            const url = `https://oapi.dingtalk.com/media/upload?access_token=${encodeURIComponent(accessToken)}&type=${encodeURIComponent(type)}`;

            // 构建multipart/form-data请求体
            const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
            const CRLF = '\r\n';

            // 将文件数据转换为Uint8Array
            let fileBytes;
            if (fileData instanceof Blob) {
                fileBytes = new Uint8Array(await fileData.arrayBuffer());
            } else if (fileData instanceof ArrayBuffer) {
                fileBytes = new Uint8Array(fileData);
            } else if (fileData instanceof Uint8Array) {
                fileBytes = fileData;
            } else {
                throw new Error('fileData must be Blob, ArrayBuffer, or Uint8Array');
            }

            // 构建multipart body
            const parts = [];
            // type字段
            parts.push(`--${boundary}${CRLF}`);
            parts.push(`Content-Disposition: form-data; name="type"${CRLF}${CRLF}`);
            parts.push(`${type}${CRLF}`);

            // media字段（文件）
            parts.push(`--${boundary}${CRLF}`);
            parts.push(`Content-Disposition: form-data; name="media"; filename="${filename}"${CRLF}`);
            parts.push(`Content-Type: application/octet-stream${CRLF}${CRLF}`);

            // 将所有文本部分转换为Uint8Array
            const encoder = new TextEncoder();
            const textParts = parts.map(p => encoder.encode(p));
            const endBoundary = encoder.encode(`${CRLF}--${boundary}--${CRLF}`);

            // 合并所有部分
            const totalLength = textParts.reduce((sum, part) => sum + part.length, 0) + fileBytes.length + endBoundary.length;
            const body = new Uint8Array(totalLength);

            let offset = 0;
            textParts.forEach(part => {
                body.set(part, offset);
                offset += part.length;
            });
            body.set(fileBytes, offset);
            offset += fileBytes.length;
            body.set(endBoundary, offset);

            // 发送请求
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: url,
                    headers: {
                        'Content-Type': `multipart/form-data; boundary=${boundary}`
                    },
                    data: body.buffer,
                    responseType: 'json',
                    onload: (response) => {
                        const status = response.status || 0;
                        if (status >= 200 && status < 300) {
                            try {
                                const result = JSON.parse(response.responseText);
                                if (result.errcode === 0) {
                                    resolve({
                                        mediaId: result.media_id,
                                        type: result.type,
                                        createdAt: result.created_at
                                    });
                                } else {
                                    reject(new Error(`API Error: ${result.errmsg} (code: ${result.errcode})`));
                                }
                            } catch (e) {
                                reject(new Error('Failed to parse response'));
                            }
                        } else {
                            reject(new Error(`HTTP ${status}: ${response.responseText}`));
                        }
                    },
                    onerror: (error) => {
                        reject(new Error('Network error: ' + error.error));
                    }
                });
            });
        },

        // ------------------------
        // Internal Helpers
        // ------------------------
        /**
         * 带鉴权请求封装
         */
        async _requestAuthed(method, path, query, body) {
            const url = this._buildUrl(path, query);
            const token = await this.getAccessToken();
            return this._request(method, url, {
                headers: { 'x-acs-dingtalk-access-token': token, 'Content-Type': 'application/json' },
                body
            });
        },

        /**
         * 组装 URL（拼接 query）
         */
        _buildUrl(path, query) {
            if (!query || Object.keys(query).length === 0) {
                return `${this.config.BASE_URL}${path}`;
            }
            const q = new URLSearchParams();
            Object.keys(query).forEach((k) => {
                if (query[k] !== undefined && query[k] !== null) {
                    q.append(k, String(query[k]));
                }
            });
            return `${this.config.BASE_URL}${path}?${q.toString()}`;
        },

        /**
         * 请求入口，负责重试策略
         */
        async _request(method, url, options = {}) {
            const retryCfg = Object.assign({}, this.config.RETRY, options.retry);
            let attempt = 0;

            while (true) {
                try {
                    return await this._doRequest(method, url, options);
                } catch (err) {
                    attempt += 1;
                    const shouldRetry = this._isRetriableError(err);
                    if (!shouldRetry || attempt > retryCfg.maxRetries) {
                        throw err;
                    }
                    // 采用指数退避 + 抖动
                    const delay = this._calcDelay(retryCfg, attempt);
                    await this._sleep(delay);
                }
            }
        },

        /**
         * 实际发起请求
         */
        _doRequest(method, url, options) {
            const headers = options.headers || {};
            const body = options.body;
            let data = null;

            if (body !== undefined && body !== null && method !== 'GET') {
                const contentType = headers['Content-Type'] || headers['content-type'] || '';
                // JSON 请求体自动序列化
                if (contentType.includes('application/json') && typeof body === 'object') {
                    data = JSON.stringify(body);
                } else {
                    data = body;
                }
            }
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method,
                    url,
                    headers,
                    data,
                    onload: (response) => {
                        const status = response.status || 0;
                        const isOk = status >= 200 && status < 300;
                        if (!isOk) {
                            const err = new Error(`HTTP ${status}, responseText: ${response.responseText}`);
                            err.status = status;
                            err.responseText = response.responseText;
                            err.response = response;
                            reject(err);
                            return;
                        }

                        const text = response.responseText || '';
                        try {
                            // 尝试解析 JSON
                            resolve(text ? JSON.parse(text) : {});
                        } catch {
                            resolve(text);
                        }
                    },
                    onerror: (error) => {
                        const err = new Error('Network error');
                        err.isNetworkError = true;
                        err.error = error;
                        reject(err);
                    }
                });
            });
        },

        /**
         * 判断是否可重试（仅网络/5xx）
         */
        _isRetriableError(err) {
            if (err && err.isNetworkError) return true;
            const status = err && err.status;
            if (typeof status === 'number') {
                if (status >= 500 && status < 600) return true;
                return false;
            }
            return false;
        },

        /**
         * 计算重试等待时间（指数退避+随机抖动）
         */
        _calcDelay(retryCfg, attempt) {
            const exp = Math.min(retryCfg.baseDelayMs * Math.pow(2, attempt - 1), retryCfg.maxDelayMs);
            const jitter = exp * retryCfg.jitter * (Math.random() * 2 - 1);
            return Math.max(0, Math.floor(exp + jitter));
        },

        /**
         * 延迟工具
         */
        _sleep(ms) {
            return new Promise((resolve) => setTimeout(resolve, ms));
        },

        /**
         * 机器人消息参数标准化：
         * msgParam 若为对象，自动 JSON.stringify
         */
        _normalizeRobotPayload(payload) {
            if (!payload || typeof payload !== 'object') {
                return payload;
            }
            const copy = Object.assign({}, payload);
            if (copy.msgParam && typeof copy.msgParam === 'object') {
                copy.msgParam = JSON.stringify(copy.msgParam);
            }
            return copy;
        },


        /**
         * 格式化单元格值
         * @param {any} value - 原始值
         * @param {string} format - raw | date | datetime
         * 说明：
         * - raw：原样返回
         * - date：将 46025 这类 Excel 序列号转为 YYYY-MM-DD
         * - datetime：将 Excel 序列号转为 YYYY-MM-DD HH:mm:ss
         */
        _formatCellValue(value, format) {
            if (format === 'raw') return value;
            if (value === null || value === undefined) return value;
            if (typeof value === 'string' && value.trim() === '') return value;

            const num = typeof value === 'number' ? value : Number(value);
            if (!Number.isFinite(num)) {
                return value;
            }

            const date = this._excelSerialToDate(num);
            if (!date) return value;
            if (format === 'date') return this._formatDate(date);
            if (format === 'datetime') return this._formatDateTime(date);
            return value;
        },

        /**
         * Excel 序列号转 Date
         * - Excel 以 1899-12-30 为 0（包含 1900 闰年 bug 的常见处理）
         * - 支持小数部分表示时间
         */
        _excelSerialToDate(serial) {
            if (!Number.isFinite(serial)) return null;
            // 使用 UTC 基准计算，避免本地时区影响
            const excelEpochUtc = Date.UTC(1899, 11, 30);
            const ms = Math.round(serial * 24 * 60 * 60 * 1000);
            return new Date(excelEpochUtc + ms);
        },

        /**
         * 日期格式化为 YYYY-MM-DD
         */
        _formatDate(date) {
            const parts = this._getChinaDateParts(date);
            return `${parts.y}-${parts.m}-${parts.d}`;
        },

        /**
         * 日期时间格式化为 YYYY-MM-DD HH:mm:ss
         */
        _formatDateTime(date) {
            const parts = this._getChinaDateParts(date);
            return `${parts.y}-${parts.m}-${parts.d} ${parts.hh}:${parts.mm}:${parts.ss}`;
        },

        /**
         * 按中国标准时间（UTC+8）获取日期时间组件
         * - 通过 UTC 基准 + 8 小时偏移，避免本地时区影响
         */
        _getChinaDateParts(date) {
            const chinaOffsetMs = 8 * 60 * 60 * 1000;
            const chinaMs = date.getTime() + chinaOffsetMs;
            const d = new Date(chinaMs);
            const y = d.getUTCFullYear();
            const m = String(d.getUTCMonth() + 1).padStart(2, '0');
            const day = String(d.getUTCDate()).padStart(2, '0');
            const hh = String(d.getUTCHours()).padStart(2, '0');
            const mm = String(d.getUTCMinutes()).padStart(2, '0');
            const ss = String(d.getUTCSeconds()).padStart(2, '0');
            return { y, m, d: day, hh, mm, ss };
        },

        /**
         * 标准化列标识（数字/字母 -> 大写字母）
         * @param {string|number} column
         */
        _normalizeColumnLetter(column) {
            if (typeof column === 'number' && Number.isFinite(column)) {
                return this._columnIndexToLetter(column);
            }
            if (typeof column === 'string') {
                const text = column.trim().toUpperCase();
                if (!text) {
                    throw new Error('column is empty.');
                }
                // 简单校验：仅允许 A-Z 字母
                if (!/^[A-Z]+$/.test(text)) {
                    throw new Error('column must be a letter like "A" or "AA".');
                }
                return text;
            }
            throw new Error('column must be a letter or 0-based index.');
        },

        /**
         * 列索引（0-based）转列字母（A1 记法）
         */
        _columnIndexToLetter(index) {
            if (!Number.isFinite(index) || index < 0) {
                throw new Error('column index must be a non-negative number.');
            }
            let n = Math.floor(index);
            let letter = '';
            while (n >= 0) {
                letter = String.fromCharCode(65 + (n % 26)) + letter;
                n = Math.floor(n / 26) - 1;
            }
            return letter;
        },

        /**
         * token 存储 key
         */
        _tokenStorageKey() {
            return `dingtalk_token_${this.config.APP_KEY || 'default'}`;
        },

        /**
         * 读取缓存（先内存再存储）
         */
        _getCachedToken() {
            if (this._tokenCache && this._tokenExpireAt) {
                return { token: this._tokenCache, expireAt: this._tokenExpireAt };
            }
            const stored = this._getStore(this._tokenStorageKey());
            if (stored && stored.token && stored.expireAt) {
                this._tokenCache = stored.token;
                this._tokenExpireAt = stored.expireAt;
                return stored;
            }
            return null;
        },

        /**
         * 写入缓存（内存 + 存储）
         */
        _setCachedToken(token, expireAt) {
            this._tokenCache = token;
            this._tokenExpireAt = expireAt;
            this._setStore(this._tokenStorageKey(), { token, expireAt });
        },

        /**
         * 读取存储（优先 GM 存储）
         */
        _getStore(key) {
            if (typeof GM_getValue === 'function') {
                return GM_getValue(key, null);
            }
            try {
                const raw = localStorage.getItem(key);
                return raw ? JSON.parse(raw) : null;
            } catch {
                return null;
            }
        },

        /**
         * 写入存储（优先 GM 存储）
         */
        _setStore(key, value) {
            if (typeof GM_setValue === 'function') {
                GM_setValue(key, value);
                return;
            }
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch { }
        },

        /**
         * 删除存储（优先 GM 存储）
         */
        _removeStore(key) {
            if (typeof GM_deleteValue === 'function') {
                GM_deleteValue(key);
                return;
            }
            try {
                localStorage.removeItem(key);
            } catch { }
        }
    };

    if (typeof window !== 'undefined') {
        // 浏览器环境挂全局
        window.DingTalkSDK = DingTalkSDK;
    }

    /**
     * 飞书API工具类
     */
    const FeishuAPI = {
        // 配置
        config: {
            APP_ID: '',
            APP_SECRET: '',
            BASE_URL: 'https://open.feishu.cn/open-apis'
        },

        // 缓存的token
        _cachedToken: null,
        _tokenExpireTime: 0,

        /**
         * 初始化配置
         * @param {string} appId - 应用ID
         * @param {string} appSecret - 应用密钥
         */
        init(appInfo) {
            this.config.APP_ID = appInfo.appId
            this.config.APP_SECRET = appInfo.appSecret
        },

        /**
         * 检查飞书API是否初始化
         */
        checkInitialized() {
            if (!this.config.APP_ID || !this.config.APP_SECRET) {
                UI.showMessage('error', '请先配置飞书应用ID和密钥')
            }
        },

        /**
         * 获取租户访问令牌
         * @returns {Promise<string>} tenant_access_token
         */
        async getTenantAccessToken() {
            // 检查缓存的token是否还有效(提前5分钟刷新)
            const now = Date.now()
            if (this._cachedToken && this._tokenExpireTime > now + 5 * 60 * 1000) {
                return this._cachedToken
            }

            const url = `${this.config.BASE_URL}/auth/v3/tenant_access_token/internal`
            const data = {
                app_id: this.config.APP_ID,
                app_secret: this.config.APP_SECRET
            }
            const response = await Utils.sendHttpRequest('POST', url, {
                'Content-Type': 'application/json; charset=utf-8'
            }, data)

            const result = JSON.parse(response)
            if (result.code !== 0) {
                throw new Error(`获取token失败: ${result.msg}`)
            }

            // 缓存token
            this._cachedToken = result.tenant_access_token
            this._tokenExpireTime = now + result.expire * 1000

            return result.tenant_access_token
        },

        /**
         * 获取工作表列表
         * @param {string} spreadsheetToken - 表格token
         * @returns {Promise<Array>} 工作表列表
         * @example
         * const sheets = await FeishuAPI.getSheets('shtcnxxxxxx')
         * // 返回格式:
         * // [{
         * //   sheet_id: 'sxj5ws',
         * //   title: 'Sheet1',
         * //   index: 0,
         * //   hidden: false,
         * //   grid_properties: { frozen_row_count: 0, frozen_column_count: 0, row_count: 200, column_count: 20 },
         * //   resource_type: 'sheet',
         * //   merges: []
         * // }]
         */
        async getSheets(spreadsheetToken) {
            const token = await this.getTenantAccessToken()

            const url = `${this.config.BASE_URL}/sheets/v3/spreadsheets/${spreadsheetToken}/sheets/query`

            const response = await Utils.sendHttpRequest('GET', url, {
                'Authorization': `Bearer ${token}`
            })

            const result = JSON.parse(response)
            if (result.code !== 0) {
                throw new Error(`获取工作表失败: ${result.msg}`)
            }

            return result.data.sheets || []
        },

        /**
         * 读取单个范围的数据
         * @param {string} spreadsheetToken - 表格token
         * @param {string} range - 范围,格式: sheetId!A1:B10
         * @param {Object} options - 可选参数
         * @returns {Promise<Array>} 二维数组数据
         */
        async readRange(spreadsheetToken, range, options = {}) {
            const token = await this.getTenantAccessToken()

            // 构建查询参数
            const queryParams = new URLSearchParams()
            if (options.valueRenderOption) {
                queryParams.append('valueRenderOption', options.valueRenderOption)
            }
            if (options.dateTimeRenderOption) {
                queryParams.append('dateTimeRenderOption', options.dateTimeRenderOption)
            }
            if (options.user_id_type) {
                queryParams.append('user_id_type', options.user_id_type)
            }

            const queryString = queryParams.toString()
            const url = `${this.config.BASE_URL}/sheets/v2/spreadsheets/${spreadsheetToken}/values/${encodeURIComponent(range)}${queryString ? '?' + queryString : ''}`

            const response = await Utils.sendHttpRequest('GET', url, {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json; charset=utf-8'
            })

            const result = JSON.parse(response)
            if (result.code !== 0) {
                throw new Error(`读取数据失败: ${result.msg}`)
            }

            return result.data.valueRange.values || []
        },

        /**
         * 读取多个范围的数据
         * @param {string} spreadsheetToken - 表格token
         * @param {Array<string>} ranges - 范围数组
         * @param {Object} options - 可选参数
         * @returns {Promise<Array>} 多个范围的数据
         */
        async readMultipleRanges(spreadsheetToken, ranges, options = {}) {
            const token = await this.getTenantAccessToken()

            const queryParams = new URLSearchParams()
            queryParams.append('ranges', ranges.join(','))
            if (options.valueRenderOption) {
                queryParams.append('valueRenderOption', options.valueRenderOption)
            }
            if (options.dateTimeRenderOption) {
                queryParams.append('dateTimeRenderOption', options.dateTimeRenderOption)
            }
            if (options.user_id_type) {
                queryParams.append('user_id_type', options.user_id_type)
            }

            const url = `${this.config.BASE_URL}/sheets/v2/spreadsheets/${spreadsheetToken}/values_batch_get?${queryParams.toString()}`

            const response = await Utils.sendHttpRequest('GET', url, {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json; charset=utf-8'
            })

            const result = JSON.parse(response)
            if (result.code !== 0) {
                throw new Error(`读取数据失败: ${result.msg}`)
            }

            return result.data.valueRanges || []
        },

        /**
         * 向单个范围写入数据
         * @param {string} spreadsheetToken - 表格token
         * @param {string} range - 范围,格式: sheetId!A1:B10
         * @param {Array} values - 二维数组数据
         * @returns {Promise<Object>} 写入结果
         */
        async writeRange(spreadsheetToken, range, values) {
            const token = await this.getTenantAccessToken()

            const url = `${this.config.BASE_URL}/sheets/v2/spreadsheets/${spreadsheetToken}/values`
            const data = {
                valueRange: {
                    range: range,
                    values: values
                }
            }

            const response = await Utils.sendHttpRequest('PUT', url, {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json; charset=utf-8'
            }, data)

            const result = JSON.parse(response)
            if (result.code !== 0) {
                throw new Error(`写入数据失败: ${result.msg}`)
            }

            return result.data
        },

        /**
         * 向多个范围写入数据
         * @param {string} spreadsheetToken - 表格token
         * @param {Array} valueRanges - 多个范围和数据,格式: [{range: 'sheetId!A1:B2', values: [[]]}, ...]
         * @returns {Promise<Object>} 写入结果
         */
        async writeMultipleRanges(spreadsheetToken, valueRanges) {
            const token = await this.getTenantAccessToken()

            const url = `${this.config.BASE_URL}/sheets/v2/spreadsheets/${spreadsheetToken}/values_batch_update`
            const data = {
                valueRanges: valueRanges
            }

            const response = await Utils.sendHttpRequest('POST', url, {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json; charset=utf-8'
            }, data)

            const result = JSON.parse(response)
            if (result.code !== 0) {
                throw new Error(`写入数据失败: ${result.msg}`)
            }

            return result.data
        },

        /**
         * 追加数据
         * @param {string} spreadsheetToken - 表格token
         * @param {string} range - 范围,格式: sheetId!A1:B10
         * @param {Array} values - 二维数组数据
         * @param {string} insertDataOption - 插入选项: OVERWRITE 或 INSERT_ROWS
         * @returns {Promise<Object>} 追加结果
         */
        async appendData(spreadsheetToken, range, values, insertDataOption = 'OVERWRITE') {
            const token = await this.getTenantAccessToken()

            const url = `${this.config.BASE_URL}/sheets/v2/spreadsheets/${spreadsheetToken}/values_append?insertDataOption=${insertDataOption}`
            const data = {
                valueRange: {
                    range: range,
                    values: values
                }
            }

            const response = await Utils.sendHttpRequest('POST', url, {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json; charset=utf-8'
            }, data)

            const result = JSON.parse(response)
            if (result.code !== 0) {
                throw new Error(`追加数据失败: ${result.msg}`)
            }

            return result.data
        },

        /**
         * 插入数据(在指定范围上方插入)
         * @param {string} spreadsheetToken - 表格token
         * @param {string} range - 范围,格式: sheetId!A1:B10
         * @param {Array} values - 二维数组数据
         * @returns {Promise<Object>} 插入结果
         */
        async prependData(spreadsheetToken, range, values) {
            const token = await this.getTenantAccessToken()

            const url = `${this.config.BASE_URL}/sheets/v2/spreadsheets/${spreadsheetToken}/values_prepend`
            const data = {
                valueRange: {
                    range: range,
                    values: values
                }
            }

            const response = await Utils.sendHttpRequest('POST', url, {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json; charset=utf-8'
            }, data)

            const result = JSON.parse(response)
            if (result.code !== 0) {
                throw new Error(`插入数据失败: ${result.msg}`)
            }

            return result.data
        },

        /**
         * 工具函数: 将Excel日期序列号转换为日期对象
         * @param {number} serial - Excel日期序列号
         * @returns {Date} 日期对象
         */
        excelSerialToDate(serial) {
            const excelEpoch = new Date(1899, 11, 30)
            const days = Math.floor(serial)
            const milliseconds = days * 24 * 60 * 60 * 1000
            return new Date(excelEpoch.getTime() + milliseconds)
        },

        /**
         * 工具函数: 解析日期(支持多种格式)
         * @param {string|number} dateStr - 日期字符串或序列号
         * @returns {string|null} 标准格式日期 YYYY/M/D
         */
        parseDate(dateStr) {
            if (!dateStr) return null

            const str = String(dateStr).trim()

            // 检查是否为纯数字(Excel序列号)
            if (/^\d+$/.test(str)) {
                const serial = parseInt(str)
                if (serial > 0 && serial < 100000) {
                    const date = this.excelSerialToDate(serial)
                    const year = date.getFullYear()
                    const month = date.getMonth() + 1
                    const day = date.getDate()
                    return `${year}/${month}/${day}`
                }
            }

            // 格式: YYYY/MM/DD 或 YYYY/M/D
            const match1 = str.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
            if (match1) {
                return `${match1[1]}/${parseInt(match1[2])}/${parseInt(match1[3])}`
            }

            // 格式: YYYY-MM-DD
            const match2 = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
            if (match2) {
                return `${match2[1]}/${parseInt(match2[2])}/${parseInt(match2[3])}`
            }

            return null
        },

        /**
         * 工具函数: 列索引转字母
         * @param {number} index - 列索引(0-based)
         * @returns {string} 列字母
         */
        columnIndexToLetter(index) {
            let letter = ''
            while (index >= 0) {
                letter = String.fromCharCode(65 + (index % 26)) + letter
                index = Math.floor(index / 26) - 1
            }
            return letter
        },

        /**
         * 工具函数: 列字母转索引
         * @param {string} letter - 列字母
         * @returns {number} 列索引(0-based)
         */
        columnLetterToIndex(letter) {
            let index = 0
            for (let i = 0; i < letter.length; i++) {
                index = index * 26 + (letter.charCodeAt(i) - 64)
            }
            return index - 1
        }
    }

    // ========== 模块注册管理器 ==========
    class ModuleRegistryManager {
        constructor() {
            this.modules = new Map()  // 存储所有注册的模块
            this.urlModules = new Map()  // 按URL模式分组的模块
            this.activeModules = new Set()  // 当前活跃的模块
            this.lastUrl = null
            this.isInitialized = false
        }

        static getInstance() {
            if (!this.instance) {
                this.instance = new ModuleRegistryManager()
            }
            return this.instance
        }

        /**
         * 注册模块
         * @param {string} moduleId - 模块唯一标识
         * @param {RegExp} urlPattern - URL匹配模式
         * @param {Function} moduleFactory - 模块工厂函数
         * @param {Function} cleanupCallback - 清理回调函数
         * @param {Object} options - 可选配置 { priority: 优先级(数字越大优先级越高), enabled: 是否启用(默认true), moduleConfig: 模块配置对象 }
         * @param {Object} options.moduleConfig - 模块配置对象 { name: 模块名称, description: 模块描述, configFields: 配置字段数组 }
         */
        registerModule(moduleId, urlPattern, moduleFactory, cleanupCallback, options = {}) {
            const moduleEntry = {
                id: moduleId,
                urlPattern: urlPattern,
                factory: moduleFactory,
                cleanup: cleanupCallback,
                instance: null,
                priority: options.priority || 0,
                enabled: options.enabled !== undefined ? options.enabled : true,
                moduleConfig: options.moduleConfig || null, // 模块配置对象（名称、描述、配置字段等）
            }

            // 存储模块配置
            this.modules.set(moduleId, moduleEntry)

            // 按URL模式分组
            if (!this.urlModules.has(urlPattern)) {
                this.urlModules.set(urlPattern, [])
            }
            this.urlModules.get(urlPattern).push(moduleId)

            console.log(`模块注册成功: ${moduleId} (优先级: ${moduleEntry.priority})`)
        }

        /**
         * 获取所有模块的配置信息
         * @returns {Object} - 以moduleId为键的模块配置对象
         */
        getAllModuleConfigs() {
            const configs = {}
            for (const [moduleId, moduleEntry] of this.modules) {
                if (moduleEntry.moduleConfig) {
                    configs[moduleId] = moduleEntry.moduleConfig
                }
            }
            return configs
        }

        /**
         * 获取单个模块的配置信息
         * @param {string} moduleId - 模块唯一标识
         * @returns {Object|null} - 模块配置对象
         */
        getModuleConfig(moduleId) {
            const moduleEntry = this.modules.get(moduleId)
            return moduleEntry ? moduleEntry.moduleConfig : null
        }
        //获取模块是否启用
        getModuleEnabled(moduleId) {
            const moduleConfig = this.modules.get(moduleId)
            return moduleConfig ? moduleConfig.enabled : false
        }

        /**
         * 注销模块
         */
        unregisterModule(moduleId) {
            const moduleConfig = this.modules.get(moduleId)
            if (!moduleConfig) return

            // 清理活跃实例
            if (this.activeModules.has(moduleId) && moduleConfig.instance && moduleConfig.cleanup) {
                moduleConfig.cleanup(moduleConfig.instance)
            }

            // 从URL分组中移除
            const urlPattern = moduleConfig.urlPattern
            if (this.urlModules.has(urlPattern)) {
                const moduleIds = this.urlModules.get(urlPattern)
                const index = moduleIds.indexOf(moduleId)
                if (index > -1) {
                    moduleIds.splice(index, 1)
                }
                if (moduleIds.length === 0) {
                    this.urlModules.delete(urlPattern)
                }
            }

            // 删除模块配置
            this.modules.delete(moduleId)
            this.activeModules.delete(moduleId)

            console.log(`模块注销成功: ${moduleId}`)
        }

        /**
         * 启用/禁用模块
         */
        setModuleEnabled(moduleId, enabled) {
            const moduleConfig = this.modules.get(moduleId)
            if (moduleConfig) {
                moduleConfig.enabled = enabled
                // 如果当前在匹配的页面，重新处理路由
                if (moduleConfig.urlPattern.test(location.href.split('?')[0] + '?')) {
                    this.handleRouteChange()
                }
            }
        }

        /**
         * 获取模块实例
         */
        getModule(moduleId) {
            const moduleConfig = this.modules.get(moduleId)
            return moduleConfig ? moduleConfig.instance : null
        }

        /**
         * 获取指定URL的所有匹配模块（按优先级排序）
         */
        getMatchingModules(url) {
            const matchingModules = []

            for (const [pattern, moduleIds] of this.urlModules.entries()) {
                if (pattern.test(url)) {
                    for (const moduleId of moduleIds) {
                        const moduleConfig = this.modules.get(moduleId)
                        if (moduleConfig && moduleConfig.enabled) {
                            matchingModules.push(moduleConfig)
                        }
                    }
                }
            }

            // 按优先级排序（数字越大优先级越高）
            return matchingModules.sort((a, b) => b.priority - a.priority)
        }

        /**
         * 启动管理器
         */
        start() {
            if (this.isInitialized) return
            this.isInitialized = true

            // 监听URL变化
            window.addEventListener('popstate', () => this.handleRouteChange())

            // 监听pushState和replaceState
            const originalPushState = history.pushState
            const originalReplaceState = history.replaceState

            history.pushState = (...args) => {
                originalPushState.apply(history, args)
                this.handleRouteChange()
            }

            history.replaceState = (...args) => {
                originalReplaceState.apply(history, args)
                this.handleRouteChange()
            }

            // 初始路由处理
            this.handleRouteChange()
            console.log('模块注册管理器已启动')

        }

        /**
         * 停止管理器
         */
        stop() {
            this.isInitialized = false

            // 清理所有活跃模块
            for (const moduleId of this.activeModules) {
                const moduleConfig = this.modules.get(moduleId)
                if (moduleConfig && moduleConfig.instance && moduleConfig.cleanup) {
                    moduleConfig.cleanup(moduleConfig.instance)
                }
                moduleConfig.instance = null
            }

            this.activeModules.clear()
            console.log('模块注册管理器已停止')
        }

        /**
         * 处理路由变化
         */
        handleRouteChange() {
            // 不记录url参数
            let currentUrl = location.href
            currentUrl = currentUrl.split('?')[0] + '?'
            if (currentUrl === this.lastUrl) return
            this.lastUrl = currentUrl

            console.log('URL变化:', currentUrl)

            // 获取所有匹配的模块
            const matchingModules = this.getMatchingModules(currentUrl)

            if (matchingModules.length === 0) {
                console.log('未找到匹配的模块')
            } else {
                console.log(`找到 ${matchingModules.length} 个匹配模块`)
            }

            // 清理不需要的模块
            const modulesToKeep = new Set(matchingModules.map(m => m.id))
            for (const moduleId of this.activeModules) {
                if (!modulesToKeep.has(moduleId)) {
                    const moduleConfig = this.modules.get(moduleId)
                    if (moduleConfig && moduleConfig.instance && moduleConfig.cleanup) {
                        moduleConfig.cleanup(moduleConfig.instance)
                        moduleConfig.instance = null
                    }
                    this.activeModules.delete(moduleId)
                }
            }

            // 启动新模块或更新现有模块
            for (const moduleConfig of matchingModules) {
                if (!this.activeModules.has(moduleConfig.id)) {
                    // 创建新模块实例
                    console.log(`创建模块实例: ${moduleConfig.id}`)
                    moduleConfig.instance = moduleConfig.factory()
                    this.activeModules.add(moduleConfig.id)
                }
            }
        }

        /**
         * 获取当前活跃模块列表
         */
        getActiveModules() {
            return Array.from(this.activeModules).map(moduleId => {
                const moduleConfig = this.modules.get(moduleId)
                return {
                    id: moduleId,
                    instance: moduleConfig.instance,
                    priority: moduleConfig.priority
                }
            })
        }

        /**
         * 获取所有注册模块信息
         */
        getAllModules() {
            return Array.from(this.modules.entries()).map(([id, config]) => ({
                id,
                enabled: config.enabled,
                priority: config.priority,
                active: this.activeModules.has(id),
                urlPattern: config.urlPattern
            }))
        }

        /**
         * 获取当前URL
         */
        getCurrentUrl() {
            return location.href
        }

    }

    // ========== 请求监听器管理器 ==========
    class RequestListenerManager {
        constructor() {
            this.listeners = new Map();
            this.isIntercepting = false;

            // 原生引用
            this.OriginalXHR = window.XMLHttpRequest;
            this.originalOpen = null;
            this.originalSend = null;

            this.originalFetch = null;
        }

        addListener(id, urlRegex, callback) {
            this.listeners.set(id, { urlRegex, callback });
            if (!this.isIntercepting) this.startIntercepting();
            return id;
        }

        removeListener(id) {
            this.listeners.delete(id);
            if (this.listeners.size === 0) this.stopIntercepting();
        }

        clear() {
            this.listeners.clear();
            this.stopIntercepting();
        }

        startIntercepting() {
            if (this.isIntercepting) return;
            this.isIntercepting = true;

            this.hookXHR();
            this.hookFetch();
        }

        stopIntercepting() {
            this.isIntercepting = false;
        }

        // ============================================================
        //               XHR Hook（100% 不漏钩版）
        // ============================================================
        hookXHR() {
            if (this.originalOpen) return; // 避免重复 Hook

            const self = this;
            const OriginalXHR = this.OriginalXHR;

            this.originalOpen = OriginalXHR.prototype.open;
            this.originalSend = OriginalXHR.prototype.send;

            // ------- 1. Hook open（提前注册监听器） -------
            OriginalXHR.prototype.open = function (method, url, async, user, password) {
                this._method = method;
                // 规范化 URL
                if (!/^https?:\/\//.test(url) && !url.startsWith("//")) {
                    this._url = window.location.origin + (url.startsWith("/") ? url : "/" + url);
                } else {
                    this._url = url;
                }
                return self.originalOpen.apply(this, arguments);
            };


            // ------- 2. Hook send（激活 readyState 触发） -------
            OriginalXHR.prototype.send = function (body) {
                const xhr = this;
                const originOnLoad = xhr.onload
                xhr.onload = function () {
                    self.dispatchXHR(xhr);
                    if (originOnLoad) {
                        originOnLoad.apply(xhr, arguments)
                    }
                }
                return self.originalSend.apply(this, arguments);
            };
        }



        // ============================================================
        //         统一触发监听器（兼容 fetch + XHR）
        // ============================================================
        dispatchXHR(xhr) {
            if (!this.isIntercepting) return;
            const url = xhr._url || "";
            const responseText = xhr.responseText;
            for (const [id, { urlRegex, callback }] of this.listeners.entries()) {
                if (urlRegex.test(url)) {
                    try {
                        callback(url, responseText, {
                            listenerId: id,
                            method: xhr._method,
                            url,
                            status: xhr.status,
                            xhr
                        });
                    } catch (err) {
                        console.error("[RequestListenerManager] XHR 回调报错:", err);
                    }
                }
            }
        }


        // ============================================================
        //                     fetch Hook（稳定版）
        // ============================================================
        hookFetch() {
            if (this.originalFetch) return;

            const self = this;
            this.originalFetch = window.fetch;

            window.fetch = function (...args) {
                return self.originalFetch.apply(this, args).then((response) => {
                    const url = response.url || args[0];

                    self.dispatchFetch(url, response);

                    return response;
                });
            };

            console.log("%c[fetch Hook] 已启用（v4.0）", "color: green;");
        }

        dispatchFetch(url, response) {
            if (!this.isIntercepting) return;
            console.log
            for (const [id, { urlRegex, callback }] of this.listeners.entries()) {
                if (urlRegex.test(url)) {
                    response.clone().text().then(text => {
                        try {
                            callback(url, text, {
                                listenerId: id,
                                method: response.request.method,
                                url: response.url,
                                status: response.status,
                                response
                            });
                        } catch (err) {
                            console.error("[RequestListenerManager] fetch 回调报错:", err);
                        }
                    });
                    break;
                }
            }
        }

    }

    /* =========================公共基础方法类 END=========================== */

    /* =========================功能模块=========================== */

    // ========== 模块基类 ==========
    /**
     * 模块基类 - 所有功能模块应继承此类
     * 提供统一的接口：init、destroy、getConfig
     */
    class ModuleBase {
        /**
         * 模块唯一标识，子类必须定义
         * @example static moduleId = 'moduleName'
         */
        static moduleId = null

        /**
         * 模块配置定义，子类可选定义
         * @example
         * static moduleConfig = {
         *     name: '模块名称',
         *     description: '模块描述',
         *     configFields: [
         *         { key: 'fieldKey', label: '字段标签', type: 'text', placeholder: '提示文本' }
         *     ]
         * }
         */
        static moduleConfig = null

        /**
         * 初始化模块
         * 子类应重写此方法实现具体的初始化逻辑
         * @abstract
         */
        init() {
            throw new Error(`Module ${this.constructor.moduleId} must implement init() method`)
        }

        /**
         * 销毁模块
         * 子类应重写此方法实现资源清理
         * @abstract
         */
        destroy() {
            throw new Error(`Module ${this.constructor.moduleId} must implement destroy() method`)
        }

        /**
         * 获取当前模块的配置值
         * @param {string} key - 配置项名称
         * @param {*} defaultValue - 默认值
         * @returns {*} 配置值
         */
        getConfig(key, defaultValue = undefined) {
            return ConfigManager.getInstance().getModuleConfig(this.constructor.moduleId, key, defaultValue)
        }
    }

    // ========== 商品列表增强 ==========
    class ProductListModule extends ModuleBase {
        static moduleId = 'productListModule'
        static moduleConfig = {
            name: '商品列表增强',
            description: '增加商品货号显示、库存弹窗一件同步现货库存。'
        }

        constructor(requestListenerManager) {
            super()
            this.productUpdateTime = 0
            this.productMap = new Map()
            this.productTitles = new Map()
            this.requestListenerManager = requestListenerManager
            this.listeners = []
            this.replaceAbortFlag = false
            this.replaceTitleErrorList = []
        }

        init() {
            this.setupRequestListeners()
            this.createShowReplaceTitleDialogBtn()
            this.createMonitor()
            this.setupStockEditPlugin()

        }

        destroy() {
            console.log('销毁商品列表增强模块')

            // 清理新的监听器控制器
            if (this.monitorController) {
                this.monitorController.stop()
                this.monitorController = null
            }
            // 清理请求监听器
            this.listeners.forEach(listenerId => {
                if (this.requestListenerManager) {
                    this.requestListenerManager.removeListener(listenerId)
                }
            })
            this.listeners = []

            // 清理数据
            this.productMap.clear()
            this.productTitles.clear()

            console.log('商品列表增强模块已销毁')
        }

        /* ================= 插件：批量替换标题名称中关键词 ========================== */
        createShowReplaceTitleDialogBtn() {
            const replaceTitleBtn = document.createElement('button')
            replaceTitleBtn.textContent = '批量改标题'
            replaceTitleBtn.style.fontSize = '12px'
            replaceTitleBtn.style.marginLeft = '8px'
            replaceTitleBtn.style.lineHeight = '14px'
            replaceTitleBtn.style.padding = '6px 12px'
            replaceTitleBtn.style.backgroundColor = '#ffff'
            replaceTitleBtn.style.color = '#252931'
            replaceTitleBtn.style.border = '1px solid #dcdee1'
            replaceTitleBtn.style.borderRadius = '4px'
            replaceTitleBtn.style.cursor = 'pointer'
            replaceTitleBtn.style.verticalAlign = 'middle'
            //设置hover样式
            replaceTitleBtn.style.transition = 'all 0.3s ease'
            replaceTitleBtn.addEventListener('mouseenter', () => {
                replaceTitleBtn.style.backgroundColor = '#fff'
                replaceTitleBtn.style.borderColor = '#4784ff'
                replaceTitleBtn.style.color = '#4784ff'
            })
            replaceTitleBtn.addEventListener('mouseleave', () => {
                replaceTitleBtn.style.backgroundColor = '#ffff'
                replaceTitleBtn.style.borderColor = '#dcdee1'
                replaceTitleBtn.style.color = '#252931'
            })

            replaceTitleBtn.addEventListener('click', () => {
                this.showReplaceTitleDialog()
            })
            // 定位class以style_rightButtonGroup__ xpath定位开头元素 插入按钮
            Utils.waitForElementByXPath('//*[starts-with(@class,"style_rightButtonGroup__")]', 5000).then((rightButtonGroup) => {
                if (rightButtonGroup) {
                    rightButtonGroup.prepend(replaceTitleBtn)
                }
            })
        }
        // 显示批量替换标题名称中关键词对话框
        showReplaceTitleDialog() {
            // 创建模态框覆盖层
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 100000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            `;

            // 创建模态框内容
            const modalContent = document.createElement('div');
            modalContent.style.cssText = `
                background: white;
                border-radius: 8px;
                width: 500px;
                max-width: 90%;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            `;

            // 模态框HTML结构
            modalContent.innerHTML = `
                <div style="padding: 20px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
                    <h2 style="margin: 0; font-size: 20px; font-weight: 600; color: #111827;">批量替换标题关键词</h2>
                    <button id="replace-title-close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280; padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 4px;">&times;</button>
                </div>
                <div style="padding: 20px;">
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151;">替换关键词</label>
                        <input 
                            type="text" 
                            id="replace-keyword" 
                            placeholder="请输入要替换的关键词" 
                            style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box;"
                        >
                    </div>
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151;">替换内容</label>
                        <input 
                            type="text" 
                            id="replace-content" 
                            placeholder="请输入替换后的内容" 
                            style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box;"
                        >
                    </div>
                </div>
                <div style="padding: 20px; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: 8px;">
                    <button id="replace-title-cancel" style="padding: 8px 16px; background-color: #f3f4f6; color: #374151; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; cursor: pointer; transition: all 0.2s;">取消</button>
                    <button id="replace-title-submit" style="padding: 8px 16px; background-color: #3b82f6; color: white; border: 1px solid #3b82f6; border-radius: 6px; font-size: 14px; cursor: pointer; transition: all 0.2s;">批量替换</button>
                </div>
            `;

            // 组装模态框
            overlay.appendChild(modalContent);
            document.body.appendChild(overlay);

            // 关闭按钮事件
            document.getElementById('replace-title-close').addEventListener('click', () => {
                overlay.remove();
            });

            // 取消按钮事件
            document.getElementById('replace-title-cancel').addEventListener('click', () => {
                overlay.remove();
            });

            // 批量替换按钮事件
            document.getElementById('replace-title-submit').addEventListener('click', () => {
                const keyword = document.getElementById('replace-keyword').value;
                const content = document.getElementById('replace-content').value;

                if (!keyword) {
                    UI.showMessage('error', '请输入替换关键词');
                    return;
                }
                if (!content) {
                    UI.showMessage('error', '请输入替换内容');
                    return;
                }
                // 关闭模态框
                this.doReplaceTitle(keyword, content, overlay)
            });
        }

        //显示正在替换模态框，提供中止按钮
        showReplaceingDialog() {
            // 创建半透明遮罩层
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 100001;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            `;

            // 创建模态框内容
            const modalContent = document.createElement('div');
            modalContent.style.cssText = `
                background: white;
                border-radius: 8px;
                width: 500px;
                max-width: 90%;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                text-align: center;
            `;

            // 模态框HTML结构
            modalContent.innerHTML = `
                <div style="padding: 30px;">
                    <div style="margin-bottom: 20px;">
                        <!-- 加载动画 -->
                        <div style="width: 50px;
                                  height: 50px;
                                  border: 4px solid #f3f3f3;
                                  border-top: 4px solid #3498db;
                                  border-radius: 50%;
                                  margin: 0 auto 20px;
                                  animation: spin 1s linear infinite;
                                  box-sizing: border-box;">
                        </div>
                        <h3 style="margin: 0 0 10px; font-size: 18px; font-weight: 600; color: #111827;">正在批量替换标题</h3>
                        <p style="margin: 0; font-size: 14px; color: #6b7280;">正在替换商品标题中的关键词，请稍候...</p>
                    </div>
                    <!-- 结果展示区域 -->
                    <div id="replace-results" style="margin-bottom: 20px; padding: 16px; background-color: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb; display: none;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <h4 style="margin: 0; font-size: 16px; font-weight: 600; color: #111827;">替换结果</h4>
                            <button id="copy-fail-ids-btn" 
                                    style="padding: 6px 12px; 
                                           background-color: #3b82f6; 
                                           color: white; 
                                           border: 1px solid #3b82f6; 
                                           border-radius: 4px; 
                                           font-size: 12px; 
                                           font-weight: 500; 
                                           cursor: pointer; 
                                           transition: all 0.2s; 
                                           display: inline-block;">
                                一键复制ID
                            </button>
                        </div>
                        <div id="fail-list" style="max-height: 200px; overflow-y: auto; font-size: 14px; color: #4b5563;">
                            <!-- 失败商品列表将在这里动态生成 -->
                        </div>
                    </div>
                    <div style="display: flex; justify-content: center; gap: 12px;">
                        <button id="abort-replace-btn" 
                                style="padding: 6px 12px; 
                                       background-color: #dc2626;
                                       color: white;
                                       border: 1px solid #dc2626;
                                       border-radius: 4px;
                                       font-size: 12px;
                                       font-weight: 500;
                                       cursor: pointer;
                                       transition: all 0.2s;">
                            中止替换
                        </button>
                        <button id="close-replace-btn" 
                                style="padding: 6px 12px; 
                                       background-color: #3b82f6;
                                       color: white;
                                       border: 1px solid #3b82f6;
                                       border-radius: 4px;
                                       font-size: 12px;
                                       font-weight: 500;
                                       cursor: pointer;
                                       display: none;
                                       transition: all 0.2s;">
                            关闭弹窗
                        </button>
                    </div>
                </div>
                <style>
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            `;

            // 组装模态框
            overlay.appendChild(modalContent);
            document.body.appendChild(overlay);

            // 中止按钮事件处理
            const abortBtn = document.getElementById('abort-replace-btn');
            let abortHandler;

            // 创建中止事件处理函数
            const handleAbort = () => {
                // 触发中止替换事件
                if (this.onAbortReplace) {
                    this.onAbortReplace();
                }
                this.replaceAbortFlag = true
                // 关闭模态框
                overlay.remove();

                // 显示中止提示
                UI.showMessage('success', '批量替换已中止');
            };

            // 绑定事件
            abortBtn.addEventListener('click', handleAbort);

            // 获取结果区域元素
            const resultsDiv = modalContent.querySelector('#replace-results');
            const failListDiv = modalContent.querySelector('#fail-list');
            const copyBtn = modalContent.querySelector('#copy-fail-ids-btn');
            const closeBtn = modalContent.querySelector('#close-replace-btn');
            const loadingDiv = modalContent.querySelector('div[style*="animation: spin"]');
            const titleH3 = modalContent.querySelector('h3');
            const subtitleP = modalContent.querySelector('p');

            // 复制按钮点击事件处理
            const handleCopyIds = () => {
                if (this.replaceTitleErrorList.length > 0) {
                    // 提取商品ID并以逗号拼接
                    const ids = this.replaceTitleErrorList.map(item => item.product_id).join(',');

                    // 复制到剪贴板
                    navigator.clipboard.writeText(ids).then(() => {
                        // 显示复制成功提示
                        UI.showMessage('success', '失败商品ID已复制到剪贴板');
                    }).catch(err => {
                        console.error('复制失败:', err);
                        UI.showMessage('error', '复制失败，请重试');
                    });
                }
            };

            // 绑定复制按钮事件
            copyBtn.addEventListener('click', handleCopyIds);
            closeBtn.addEventListener('click', () => {
                overlay.remove();
            });
            // 暴露关闭方法和中止处理
            return {
                close: () => {
                    overlay.remove();
                },
                onAbort: (handler) => {
                    this.onAbortReplace = handler;
                },
                updateResults: (failedItems) => {
                    // 清空现有列表
                    failListDiv.innerHTML = '';

                    if (failedItems && failedItems.length > 0) {
                        // 创建失败商品列表
                        failedItems.forEach(item => {
                            const failItem = document.createElement('div');
                            failItem.style.cssText = `
                                padding: 8px;
                                margin-bottom: 8px;
                                background-color: #fee2e2;
                                border-radius: 4px;
                                border-left: 4px solid #ef4444;
                            `;
                            failItem.innerHTML = `
                                <div style="font-weight: 500; color: #dc2626;">商品ID: ${item.product_id}</div>
                                <div style="font-size: 12px; color: #7f1d1d;">错误: ${item.msg}</div>
                            `;
                            failListDiv.appendChild(failItem);
                        });

                        // 显示结果区域
                        resultsDiv.style.display = 'block';
                    }
                },
                showResults: () => {
                    // 隐藏加载动画
                    if (loadingDiv) {
                        loadingDiv.style.display = 'none';
                    }
                    //隐藏abort-replace-btn
                    abortBtn.style.display = 'none';
                    closeBtn.style.display = 'block';
                    // 更新标题
                    titleH3.textContent = '批量替换完成';
                    subtitleP.textContent = '商品标题替换操作已完成';
                }
            };
        }

        getEditRequestOptions() {
            // 返回一个Promise实现异步返回
            return new Promise((resolve, reject) => {
                // 监听商品列表请求
                this.requestListenerManager.addListener('productEdit', /\/product\/tproduct\/batchEdit\?/, (url, responseText, requestOptions) => {
                    setTimeout(() => {
                        try {
                            //从 requestOptions 中获取 请求参数
                            const requestParams = new URLSearchParams(requestOptions.url.split('?')[1])
                            //提取appid __token _bid _lid verifyFp fp msToken a_bogus
                            const appid = requestParams.get('appid')
                            const token = requestParams.get('__token')
                            const bid = requestParams.get('_bid')
                            const lid = requestParams.get('_lid')
                            const verifyFp = requestParams.get('verifyFp')
                            const fp = requestParams.get('fp')
                            const msToken = requestParams.get('msToken')
                            const a_bogus = requestParams.get('a_bogus')

                            // 解析成功，resolve Promise
                            resolve({
                                listenerId: requestOptions.listenerId,
                                method: requestOptions.method,
                                url: requestOptions.url,
                                params: {
                                    appid,
                                    token,
                                    bid,
                                    lid,
                                    verifyFp,
                                    fp,
                                    msToken,
                                    a_bogus,
                                }
                            })
                        } catch (error) {
                            console.error('解析编辑商品请求参数失败:', error)
                            // 解析失败，reject Promise
                            reject(error)
                        }
                    }, 500)
                })
            })
        }

        // 执行批量替换标题
        async doReplaceTitle(keyword, content, dialog) {
            dialog.remove()
            const replaceingDialog = this.showReplaceingDialog()
            try {
                const input = document.querySelector('#search-form-container input[placeholder*="输入商品名称/商品ID/商家编码"]')
                //找到id=search-form-container下第一个form元素
                Utils.changeReactInputValue(input, keyword)
                //点击clss包含ecom-g-btn且内部有文字 查询 的按钮
                const searchFormContainer = document.getElementById('search-form-container')
                // 支持查询按钮内嵌在 span 中的情况
                const queryBtn = Utils.getElementByXpath("//button[contains(@class,'ecom-g-btn')][.//text()[contains(.,'查询')]]", searchFormContainer)
                queryBtn.click()

                setTimeout(async () => {
                    document.querySelector('span.ecom-g-sp-icon[data-kora="修改标题"]')?.click();
                    try {
                        const confirmBtn = await Utils.waitForElementByXPath("//div[contains(@class,'ecom-g-modal-content')]//button[contains(@class,'ecom-g-btn')][.//text()[contains(.,'确定')]]", 2000)
                        confirmBtn.click()
                    } catch (error) {
                        if (this.productTitles.size === 0) {
                            UI.showMessage('info', '没有需要更新的商品~')
                            replaceingDialog.close()
                            this.replaceAbortFlag = false
                            return
                        } else {
                            console.error('点击确定按钮失败:', error)
                            UI.showMessage('error', '更新失败:' + error)
                            // 解析失败，reject Promise
                            replaceingDialog.close()
                            this.replaceAbortFlag = false
                            return
                        }
                    }
                    const requestOptions = await this.getEditRequestOptions()
                    //获取ecom-g-modal-content下的取消按钮，如果存在 则点击
                    setTimeout(() => {
                        const abortBtn = Utils.getElementByXpath("//div[contains(@class,'ecom-g-modal-content')]//button[contains(@class,'ecom-g-btn')][.//text()[contains(.,'取消')]]")
                        if (abortBtn) {
                            abortBtn.click()
                        }
                    }, 1000)
                    this.requestListenerManager.removeListener(requestOptions.listenerId)
                    await this.doBatchReplaceTitle(requestOptions, keyword, content, 0, replaceingDialog)
                }, 1000)
            } catch (error) {
                console.error('批量替换标题失败:', error)
                UI.showMessage('error', '批量替换标题失败:' + error)
                // 解析失败，reject Promise
                replaceingDialog.close()
                this.replaceAbortFlag = false
            }
        }

        async doBatchReplaceTitle(requestOptions, keyword, content, lastProductUpdateTime, replaceingDialog) {
            //循环等待商品列表更新
            await Utils.waitFor(() => this.productUpdateTime > lastProductUpdateTime, {
                interval: 300,
                timeout: 10000,
            })
            if (this.productTitles.size === 0) {
                UI.showMessage('info', '没有商品标题需要替换')
                replaceingDialog.close()
                this.replaceAbortFlag = false
                return
            }
            lastProductUpdateTime = this.productUpdateTime
            // 构造批量请求参数
            const batchParams = {
                product_ids: [...this.productTitles.keys()],
                name: {},
                title_info: {},
                __token: requestOptions.params.token,
                appid: Number(requestOptions.params.appid),
                _bid: requestOptions.params.bid,
                _lid: requestOptions.params.lid,
            }
            // 填充name和title_info 遍历this.productTitles
            this.productTitles.forEach((title, productId) => {
                batchParams.name[productId] = title.replaceAll(keyword, content)
                console.log(`修改商品标题:${productId}, ${title}==》${batchParams.name[productId]}`)
                batchParams.title_info[productId] = {
                    prefix: '',
                    suffix: '',
                }
            })
            // 发送批量请求
            const response = await Utils.sendHttpRequest(requestOptions.method, requestOptions.url, {}, batchParams)
            console.log('批量替换标题响应:', JSON.parse(response))
            //{"errno":0,"st":0,"msg":"","code":0,"data":[{"product_id":"3779529074049941966","code":0,"msg":"success"},{"product_id":"3779184675898130828","code":110250135,"msg":"尺码表与sku规格尺码不一致，请进入商品编辑页优化尺码表信息"},{"product_id":"3739669748389118263","code":110250135,"msg":"尺码表与sku规格尺码不一致，请进入商品编辑页优化尺码表信息"}],"page":0,"total":0,"size":0}
            //提取response中错误信息
            const errorList = JSON.parse(response).data.filter(item => item.code !== 0)
            this.replaceTitleErrorList.push(...errorList)

            // 点击class=ecom-g-pagination-next的下一页 直到按钮出现 ecom-g-pagination-disabled
            const nextPageBtn = document.querySelector('li.ecom-g-pagination-next:not(.ecom-g-pagination-disabled)')
            if (nextPageBtn) {
                if (this.replaceAbortFlag) {
                    this.replaceAbortFlag = false
                    return
                } else {
                    nextPageBtn.click()
                    // 等待下一页加载完成
                    setTimeout(() => {
                        this.doBatchReplaceTitle(requestOptions, keyword, content, lastProductUpdateTime, replaceingDialog)
                    }, 1000)
                }
            } else {
                if (this.replaceTitleErrorList.length > 0) {
                    replaceingDialog.updateResults(this.replaceTitleErrorList)
                    replaceingDialog.showResults()
                    // 显示错误信息
                    UI.showMessage('error', '批量替换标题存在失败商品，请查看')
                } else {
                    // 显示成功信息
                    UI.showMessage('success', '批量替换标题完成')
                }
                this.replaceAbortFlag = false
            }

        }


        /* ================= 插件：批量替换标题名称中关键词 END ========================== */

        /* ================= 插件：商品列表增强显示货号 ========================== */
        // 监听商品列表请求，更新商品编码映射
        setupRequestListeners() {
            // 监听商品列表请求
            const listenerId = this.requestListenerManager.addListener('productList', /\/product\/tproduct\/list\?/, (url, responseText, requestOptions) => {
                setTimeout(() => {
                    try {
                        this.updateProductMap(JSON.parse(responseText))
                    } catch (error) {
                        console.error('解析商品列表数据失败:', error)
                    }
                }, 500)
            })
            this.listeners.push(listenerId)
        }

        createMonitor() {
            // 使用 Utils.observeElementChanges 替代手动实现
            this.monitorController = Utils.observeElementChanges('[class^="ecom-g-table-wrapper"]', {
                childList: true,
                attributes: false,
                subtree: true,
                waitForElement: true,      // 等待元素出现
                waitTimeout: 30000,        // 30秒超时
                waitInterval: 1000,        // 1秒检查间隔
                debounce: 500,             // 100ms防抖
                immediate: false,
                autoStart: true
            }, (mutations, observer, element) => {
                console.log('检测到表格变化，刷新商品编码...')
                this.refreshGoodCode()
            })

            console.log('表格监听器已设置，等待目标元素出现...')
        }
        // 更新商品编码映射
        updateProductMap(productListRes) {
            this.productUpdateTime = Date.now()
            this.productMap.clear()
            this.productTitles.clear()
            for (let i = 0; i < productListRes.data.length; i++) {
                const product = productListRes.data[i]
                this.productTitles.set(product.product_id, product.name)
                if (product.product_format_new && product.product_format_new[3171] && product.product_format_new[3171][0]) {
                    const code = product.product_format_new[3171][0]['name']
                    if (code) {
                        this.productMap.set(product.product_id, code)
                    }
                }
            }
            this.refreshGoodCode()
        }
        // 刷新商品编码
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

                const codeDivs = document.querySelectorAll('.goodsCodeText')
                codeDivs.forEach(codeDiv => {
                    codeDiv.addEventListener('click', () => {
                        Utils.copyToClipboard(codeDiv.dataset.code)
                    })
                })
            }
        }
        /* ================= 插件：商品列表增强显示货号 END ========================== */

        /* ================= 插件：设置库存编辑插件 ========================== */
        setupStockEditPlugin() {
            Utils.waitForElementByXPath('//tbody[contains(@class, "ecom-g-table-tbody")]', 5000).then((element) => {
                element.addEventListener('click', (event) => {
                    const clickInventory = event.target.closest('.ecom-g-table-cell[class*="style_totalInventory__"] a');
                    if (clickInventory) {
                        Utils.waitForElementByXPath("//div[contains(@class,'index_filterBox__')]", 5000).then((filterBox) => {
                            let syncBtn = Object.assign(document.createElement('button'), {
                                innerText: '同步现货库存',
                                style: 'border-radius:8px;background-color:#1966ff;color:white;padding:3px 10px;border:none;cursor:pointer;position:absolute;right:0px;'
                            })
                            filterBox.lastElementChild.appendChild(syncBtn)
                            syncBtn.addEventListener('click', () => {
                                this.syncStock()
                            })
                        })
                    }
                })
            })
        }

        // 同步库存
        async syncStock() {
            try {
                let elementById = document.getElementById("__ffa-goods-popup-container__")
                const eTableEles = elementById.querySelectorAll('div.ecom-g-table-container')
                let values = Object.values(eTableEles[0])
                const fiberNode = values[0]
                let dataList = fiberNode.memoizedProps.children.props.children[1].props.data
                let skuIds = new Set()
                dataList.forEach(datum => {
                    let fc = datum.tableInfo.fc
                    let rowData = fc.getValue()
                    let code = rowData.code.replaceAll("=", "").replaceAll("+", "")
                    let codeFlag = code.substring(0, code.length - 4)
                    skuIds.add(codeFlag)
                })
                const stockMap = await JuShuiTanTool.getInstance().getProductInventory(Array.from(skuIds))
                if (!stockMap || stockMap.size === 0) {
                    console.error('获取到的库存数据为空')
                    UI.showMessage('error', `获取到的库存数据为空`)
                    return
                }
                dataList.forEach(datum => {
                    let fc = datum.tableInfo.fc
                    let rowData = fc.getValue()
                    let code = rowData.code.replaceAll("=", "").replaceAll("+", "")
                    try {
                        let fc = datum.tableInfo.fc
                        let header = datum.header
                        let rowData = fc.getValue()

                        if (!stockMap.has(code)) {
                            console.log("没查询到对应库存，跳过:", code)
                            return
                        }
                        let stockGetNum;
                        let lastNum = rowData.num
                        if (header[2] && header[2]['name'].includes("天内发货")) {
                            stockGetNum = stockMap.get(code + '==')
                            console.log(`skuId:${code}，更新预售库存:${lastNum}===》${stockGetNum}`)
                        } else {
                            stockGetNum = stockMap.get(code)
                            console.log(`skuId:${code}，更新现货库存:${lastNum}===》${stockGetNum}`)
                        }
                        if (stockGetNum < 0) {
                            stockGetNum = 0
                        }
                        rowData.num = stockGetNum + ''
                        fc.root.emit()

                    } catch (error) {
                        console.error(`更新skuId:${code}库存失败:`, error)
                        UI.showMessage('error', `更新skuId:${code}库存失败`)
                        return
                    }
                })
                UI.showMessage('success', '现货库存更新完成')
            } catch (e) {
                console.error('同步库存失败:', e.message)
                UI.showMessage('error', e.message)
            }
        }

        /* ================= 插件：设置库存编辑插件 END ========================== */
    }

    // ========== 直播库存预览模块 ==========
    class LiveProductStockPreviewModule extends ModuleBase {
        static moduleId = 'liveProductStockPreviewModule'
        static moduleConfig = {
            name: '直播预告功能',
            description: '一键查询前10链接库存，一键发送直播预告消息',
            configFields: [
                { key: 'topn', label: '查询前N条', placeholder: '请输入查询前N条' },
                { key: 'conversationId', label: '通知群聊ID', placeholder: '请输入通知群聊ID' }
            ]
        }

        // 视图构建工具
        static ViewHtmlBuildUtils = {
            escapeHtml(str) {
                return String(str ?? '')
                    .replaceAll('&', '&amp;')
                    .replaceAll('<', '&lt;')
                    .replaceAll('>', '&gt;')
                    .replaceAll('"', '&quot;')
                    .replaceAll("'", '&#39;');
            },

            mobile: {
                getCellData(product, color, size) {
                    const colorCode = product['颜色编码']?.[color] || '';
                    const sku = `${colorCode}${size}`;
                    const row = product['库存']?.[color]?.[sku] || {};
                    return {
                        available: row['在仓可用库存'],
                        transit: row['采购在途库存']
                    };
                },

                buildInventoryMarkup(products) {
                    return `<main class="page">${(products || []).map((product, index) => {
                        const sizes = product['鞋码大小'] || [];
                        const colors = Object.keys(product['库存'] || {});

                        const headerCells = colors.map((c) => `<th>${LiveProductStockPreviewModule.ViewHtmlBuildUtils.escapeHtml(c)}</th>`).join('');
                        const rows = sizes.map((size) => {
                            const colorCells = colors.map((color) => {
                                const { available, transit } = this.getCellData(product, color, size);
                                if (available === undefined && transit === undefined) {
                                    return '<td class="empty">-</td>';
                                }
                                const cls = available < 0 ? 'neg' : (available === 0 ? 'zero' : 'ok');
                                return `<td><div class="${cls}"><div class="main">${LiveProductStockPreviewModule.ViewHtmlBuildUtils.escapeHtml(available)}</div><div class="sub">途:${LiveProductStockPreviewModule.ViewHtmlBuildUtils.escapeHtml(transit)}</div></div></td>`;
                            }).join('');
                            return `<tr><td class="size-col">${LiveProductStockPreviewModule.ViewHtmlBuildUtils.escapeHtml(size)}</td>${colorCells}</tr>`;
                        }).join('');

                        const chips = (product['发货时效'] || []).map((i) => `<span class="chip">${LiveProductStockPreviewModule.ViewHtmlBuildUtils.escapeHtml(i)}</span>`).join('');

                        return `
                            <section class="product">
                            <div class="product-top">
                                <img src="${LiveProductStockPreviewModule.ViewHtmlBuildUtils.escapeHtml(product['图片'])}" alt="${LiveProductStockPreviewModule.ViewHtmlBuildUtils.escapeHtml(product['货号'])}" />
                                <div class="meta">
                                <span class="chip"><b>${index + 1}号链接：${LiveProductStockPreviewModule.ViewHtmlBuildUtils.escapeHtml(product['货号'] || '-')}</b></span><br>
                                <span class="chip">券后价：<b>${LiveProductStockPreviewModule.ViewHtmlBuildUtils.escapeHtml(product['价格'] || '-')}</b></span><br>
                                ${chips}
                                </div>
                            </div>
                            <div class="stock-wrap">
                                <table>
                                <thead><tr><th class="size-col">尺码</th>${headerCells}</tr></thead>
                                <tbody>${rows}</tbody>
                                </table>
                            </div>
                            </section>
                        `;
                    }).join('')}</main>`;
                },

                /**
                 * 一键生成完整 HTML 代码
                 * @param {Array<object>} products JSON数组
                 * @returns {string} 完整HTML文本
                 */
                generateCompleteHtmlCode(products) {
                    const BASE_STYLE = `
                                    :root{--bg:#f3f4f6;--card:#fff;--line:#e5e7eb;--text:#111827;--muted:#6b7280;--ok:#16a34a;--zero:#a16207;--neg:#dc2626}
                                    *{box-sizing:border-box}
                                    body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;font-size:12px;padding:8px}
                                    .page{max-width:430px;margin:0 auto;display:grid;gap:10px}
                                    .product{background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}
                                    .product-top{padding:10px;border-bottom:1px solid var(--line);display:grid;grid-template-columns:92px 1fr;gap:10px;align-items:start}
                                    .product-top img{width:92px;height:92px;object-fit:cover;border-radius:8px;border:1px solid var(--line);background:#fff}
                                    .chip{display:inline-block;border:1px solid var(--line);background:#fff;border-radius:999px;padding:2px 8px;margin:0 6px 6px 0;font-size:12px;line-height:1.4}
                                    .meta b{font-size:14px}
                                    .stock-wrap{overflow:auto;}
                                    table{border-collapse:collapse;min-width:100%;width:max-content;font-size:11px}
                                    th,td{border:1px solid var(--line);text-align:center;line-height:1.2}
                                    thead th{background:#eef2ff;white-space: normal;width: 15px;word-break: break-all;}
                                    .size-col{background:#fff;font-weight:600}
                                    thead .size-col{background:#e5e7eb}
                                    .main{font-weight:700}.sub{font-size:10px;color:var(--muted);margin: auto;width: 25px;}
                                    .ok .main{color:var(--ok)} .zero .main{color:var(--zero)} .neg .main{color:var(--neg)} .empty{color:#9ca3af}
                                `;
                    const bodyHtml = this.buildInventoryMarkup(products);
                    return `<!doctype html>
                        <html lang="zh-CN">
                        <head>
                        <meta charset="UTF-8" />
                        <meta name="viewport" content="width=device-width,initial-scale=1" />
                        <title>移动端库存看板</title>
                        <style>${BASE_STYLE}</style>
                        </head>
                        <body>
                        ${bodyHtml}
                        </body>
                        </html>`;
                }
            },

            pc: {
                buildInventoryMarkup(products) {
                    return `<main class="page">${products.map((product, index) => {
                        const sizes = product['鞋码大小'] || [];
                        const colorStocks = product['库存'] || {};
                        const colors = Object.keys(colorStocks);

                        const rows = colors.map((color) => {
                            const code = product['颜色编码']?.[color] || '';
                            const cells = sizes.map((size) => {
                                const sku = `${code}${size}`;
                                const row = colorStocks?.[color]?.[sku] || {};
                                const a = row['在仓可用库存'];
                                const t = row['采购在途库存'];
                                if (a === undefined && t === undefined) return '<td class="empty">-</td>';
                                const cls = a < 0 ? 'neg' : (a === 0 ? 'zero' : 'ok');
                                return `<td><div class="${cls}"><div class="main">${a}</div><div class="sub">在途:${t}</div></div></td>`;
                            }).join('');
                            return `<tr><td class="first">${LiveProductStockPreviewModule.ViewHtmlBuildUtils.escapeHtml(color)}<br><span class="sub">${LiveProductStockPreviewModule.ViewHtmlBuildUtils.escapeHtml(code)}</span></td>${cells}</tr>`;
                        }).join('');

                        return `
                            <section class="product">
                            <aside class="left">
                                <img src="${LiveProductStockPreviewModule.ViewHtmlBuildUtils.escapeHtml(product['图片'] || '')}" alt="${LiveProductStockPreviewModule.ViewHtmlBuildUtils.escapeHtml(product['货号'] || '')}" />
                                <div class="meta">
                                <span class="chip"><b>${index + 1}号链接：${LiveProductStockPreviewModule.ViewHtmlBuildUtils.escapeHtml(product['货号'] || '-')}</b></span><br>
                                <span class = "chip" style="font-size:12px;">ID:${LiveProductStockPreviewModule.ViewHtmlBuildUtils.escapeHtml(product['id'] || '-')}</span><br>
                                <div class="chip">价格：<b>${LiveProductStockPreviewModule.ViewHtmlBuildUtils.escapeHtml(product['价格'] || '-')}</b></div><br>
                                ${(product['发货时效'] || []).map((item) => `<span class="chip">${LiveProductStockPreviewModule.ViewHtmlBuildUtils.escapeHtml(item)}</span>`).join('')}
                                </div>
                            </aside>
                            <div class="right">
                                <table>
                                <thead><tr><th class="first">颜色/尺码</th>${sizes.map((s) => `<th>${LiveProductStockPreviewModule.ViewHtmlBuildUtils.escapeHtml(s)}</th>`).join('')}</tr></thead>
                                <tbody>${rows}</tbody>
                                </table>
                            </div>
                            </section>
                        `;
                    }).join('')}</main>`;
                },
                /**
                 * 一键生成完整 HTML 代码
                 * @param {Array<object>} products JSON数组
                 * @returns {string} 完整HTML文本
                 */
                generateCompleteHtmlCode(products) {
                    const BASE_STYLE = `
                        :root{--bg:#f3f4f6;--card:#fff;--line:#e5e7eb;--text:#111827;--muted:#6b7280;--ok:#16a34a;--zero:#a16207;--neg:#dc2626}
                        *{box-sizing:border-box}
                        body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;font-size:12px;padding:8px}
                        .page{margin:0 auto;display:grid;gap:8px}
                        .product{display:grid;grid-template-columns:275px 1fr;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden;}
                        .left{border-right:1px solid var(--line);padding:8px;display:grid;grid-template-columns:100px auto;gap:8px;align-content:start;background:#fafafa}
                        .left img{width:100%;object-fit:cover;border-radius:8px;border:1px solid var(--line);background:#fff}
                        .chip{border:1px solid var(--line);border-radius:999px;padding:2px 8px;margin:0 4px 4px 0;display:inline-block;white-space:nowrap;background:#fff}
                        .meta b{font-size:14px}.right{padding:8px;overflow:auto}
                        table{border-collapse:collapse;min-width:100%;width:max-content;font-size:11px}
                        th,td{border:1px solid var(--line);padding:3px 5px;text-align:center;white-space:nowrap;line-height:1.2}
                        thead th{background:#eef2ff}
                        .first{background:#fff;text-align:left}
                        thead .first{background:#e5e7eb}
                        .main{font-weight:700}.sub{font-size:11px;}.ok .main{color:var(--ok)}.zero .main{color:var(--zero)}.neg .main{color:var(--neg)}.empty{color:#9ca3af}
                    `;
                    const bodyHtml = this.buildInventoryMarkup(products);
                    return `<!doctype html>
                        <html lang="zh-CN">
                        <head>
                        <meta charset="UTF-8" />
                        <meta name="viewport" content="width=device-width,initial-scale=1" />
                        <title>商品库存紧凑看板</title>
                        <style>${BASE_STYLE}</style>
                        </head>
                        <body>
                        ${bodyHtml}
                        </body>
                        </html>`;
                }
            }

        }

        constructor(requestListenerManager) {
            super()
            this.requestListenerManager = requestListenerManager
            this.listeners = []
            this.topNProductMap = new Map()
            this.productInfosWithStock = null
            this.productInfosUpdateTime = 0
            this.requestParams = null
            this.livePreviewButton = null
            this.topn = this.getConfig("topn", 5)
        }

        init() {
            this.setupRequestListeners()
        }

        destroy() {
            console.log('销毁商品库存快速获取模块')
            // 清理请求监听器
            this.listeners.forEach(listenerId => {
                if (this.requestListenerManager) {
                    this.requestListenerManager.removeListener(listenerId)
                }
            })
            this.listeners = []
            console.log('商品库存快速获取模块已销毁')
        }

        setupRequestListeners() {
            // 监听直播商品请求
            const listenerId = this.requestListenerManager.addListener('livePreviewProducts', /\/api\/anchor\/livepc\/promotions_v2\?list_type=1&source_type=force/, (url, responseText) => {
                setTimeout(() => {
                    try {
                        const liveProducts = JSON.parse(responseText)
                        liveProducts.data?.promotions?.slice(0, this.topn).forEach(product => {
                            //保留两位小数
                            const minPrice = (product.price_desc.min_price.origin / 100).toFixed(2)
                            const maxPrice = (product.price_desc.max_price.origin / 100).toFixed(2)
                            this.topNProductMap.set(product.product_id, `${minPrice}~${maxPrice}`)
                        })
                        if (this.livePreviewButton == null) {
                            this.livePreviewButton = this.createUI()
                        }
                    } catch (error) {
                        console.error('解析直播商品数据失败:', error)
                    }
                }, 500)
            })
            this.listeners.push(listenerId)
        }

        createUI() {
            return UI.addFloatingButton({
                id: 'send-live-preview-button',
                text: `查询前${this.topn}库存`,
                onClick: () => this.buildLiveProductStockPreview()
            })
        }

        // 构建直播商品库存预览
        async buildLiveProductStockPreview() {
            if (this.topNProductMap.size === 0) {
                console.error('直播商品数据为空')
                UI.showMessage('error', `直播商品数据为空`)
                return
            }
            const productIdSet = new Set(this.topNProductMap.keys())
            if (this.productInfosWithStock === null 
                || this.productInfosUpdateTime === 0 
                || Date.now() - this.productInfosUpdateTime > 10 * 60 * 1000
                || (() => {const productIdsInStock = new Set(this.productInfosWithStock.map(info => info["id"]));
                const productIdsToUpdate = new Set([...productIdSet].filter(id => !productIdsInStock.has(id)));
                return productIdsToUpdate.size !== 0})()) {
                const productInfos = await this.getProductInfo(productIdSet)
                if (!productInfos || productInfos.length === 0) {
                    console.error('获取到的商品信息为空')
                    UI.showMessage('error', `获取到的商品信息为空`)
                    return
                }
                productInfos.forEach(info => {
                    info["价格"] = this.topNProductMap.get(info["id"])
                })
                this.productInfosWithStock = await this.getProductStock(productInfos)
                this.productInfosUpdateTime = Date.now()
            }
            const pcHtml = LiveProductStockPreviewModule.ViewHtmlBuildUtils.pc.generateCompleteHtmlCode(this.productInfosWithStock)
            UI.showHtmlPreviewModal(pcHtml, "发送直播预告", async ({ iframe, done, close }) => {
                const mobileHtml = LiveProductStockPreviewModule.ViewHtmlBuildUtils.mobile.generateCompleteHtmlCode(this.productInfosWithStock)
                await this.screenshotAndSend(mobileHtml)
                done()
            })
        }

        //获取产品信息
        async getProductInfo(productIdSet) {
            const productInfo = []
            for (const productId of productIdSet) {
                const url = "/product/tproduct/previewOnline?" +
                    "product_id=" + productId +
                    "&need_live_status=false&appid=1";
                try {
                    const productInfoResponse = await Utils.request(url, {
                        method: "GET",
                        withCredentials: true
                    })
                    const productInfoJson = JSON.parse(productInfoResponse)
                    productInfo.push(this.parseProductData(productInfoJson))
                } catch (err) {
                    console.error("请求失败:", err);
                }
            }
            return productInfo;
        }

        // 获取商品库存
        async getProductStock(productInfos) {
            //收集skuid
            const codeSet = new Set();
            productInfos.forEach(info => {
                const codes = Object.values(info["颜色编码"]).map(code => code.slice(0, -2))
                codes.forEach(code => codeSet.add(code))
            })
            const stockMap = await JuShuiTanTool.getInstance().getProductInventoryDetail(Array.from(codeSet))
            if (!stockMap || stockMap.size === 0) {
                console.error('获取到的库存数据为空')
                UI.showMessage('error', `获取到的库存数据为空`)
                return
            }
            productInfos.forEach(info => {
                info["库存"] = {}
                for (const [color, code] of Object.entries(info["颜色编码"])) {
                    info["库存"][color] = {}
                    info["鞋码大小"].forEach(size => {
                        const skuid = code + size
                        info["库存"][color][skuid] = stockMap.get(skuid) || {}
                    })
                }
            })
            return productInfos;
        }

        /**
         * 截图数据并发送到群聊
         */
        async screenshotAndSend(html) {
            const conversationId = this.getConfig("conversationId")
            
            //通过html构造canvas
            const imageBlob = await Utils.captureHtmlToBlob(html, {
                width: 430
            })
            console.log("截图成功，开始上传！");
            const result = await DingTalkSDK.uploadMedia('image', imageBlob, 'image.jpg');
            console.log("上传成功：", result);
            //获取明天日期字符串
            const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
            const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
            const day = String(tomorrow.getDate()).padStart(2, '0');
            const tomorrowDate = `${month}月-${day}日`;
            const messageContent = `{"title":"明日直播预告","text": "【${tomorrowDate}直播预告】![image](${result.mediaId})"}`;
            const groupMsg = await DingTalkSDK.sendGroupMessage({
                msgKey: 'sampleMarkdown',
                msgParam: messageContent,
                openConversationId: conversationId
            });
            console.log('截图发送成功:', groupMsg);
        }

        // 解析商品数据
        parseProductData(data) {
            const productData = data.data || data;

            const result = {
                "id": productData.product_id,
                "标题": productData.name,
                "图片": productData.img,
                "货号": productData.product_format["货号"],
                "发货时效": [],
                "颜色编码": {}
            };
            if (result["货号"].startsWith("TM") && result["货号"].endsWith("QT")) {
                //去除开头和结尾的TM和QT
                result["货号"] = result["货号"].substring(2, result["货号"].length - 2);
            }

            let specSeqInfo = null;
            try {
                const extra = JSON.parse(productData.extra);
                specSeqInfo = extra.spec_seq_info;
            } catch (e) {
                console.error('解析extra字段失败:', e);
            }

            if (specSeqInfo && specSeqInfo.spec_values_seq && specSeqInfo.spec_values_seq.length >= 3) {
                result.发货时效 = specSeqInfo.spec_values_seq[2];
            } else {
                result.发货时效 = ["48小时内发货"];
            }

            const colors = specSeqInfo && specSeqInfo.spec_values_seq[0] ? specSeqInfo.spec_values_seq[0] : [];
            const sizes = specSeqInfo && specSeqInfo.spec_values_seq[1] ? specSeqInfo.spec_values_seq[1] : [];
            result.鞋码大小 = sizes;


            if (productData.spec_prices && Array.isArray(productData.spec_prices)) {
                productData.spec_prices.forEach(specPrice => {
                    if (specPrice.sell_properties && Array.isArray(specPrice.sell_properties)) {
                        let color = null;
                        specPrice.sell_properties.forEach(prop => {
                            if (prop.property_name === '颜色分类') {
                                color = prop.value_name;
                            }
                        });
                        if (result.颜色编码[color]) {
                            return;
                        }
                        let cleanCode = '';
                        if (specPrice.code) {
                            cleanCode = specPrice.code.replace(/[+=]+$/, '');
                            //去除最后两位，因为最后两位是尺码
                            cleanCode = cleanCode.slice(0, -2);
                        }

                        if (color) {
                            result.颜色编码[color] = cleanCode;
                        }
                    }
                });
            }
            return result;
        }
    }

    // ===============================
    class ProductEditModule extends ModuleBase {
        static moduleId = 'productEditModule'
        static moduleConfig = {
            name: '商品编辑增强',
            description: '增加批量设置商品编码功能'
        }

        constructor() {
            super()
        }

        init() {
            console.log('========商品编辑增强========')
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

            //等待加载完成full-screen-card元素
            Utils.waitForElementByXPath("//div[@id='full-screen-card']", -1).then((element) => {
                element.prepend(toolDiv)
            })

            showModalBtn.addEventListener('click', () => {
                showModalBtn.scrollIntoView({ behavior: 'smooth', block: 'start' })
                //处理是否完成标记
                let isCompleted = false

                // 表格sku行数据
                const eTableEles = document.querySelectorAll('div.ecom-g-table-container')
                let targetTable = null
                eTableEles.forEach(eTableEle => {
                    // 元素内包含“颜色分类”关键字
                    if (eTableEle.innerHTML.includes('颜色分类')) {
                        targetTable = eTableEle
                    }
                })
                if (!targetTable) {
                    console.log('未找到目标表格')
                    return
                }
                //有时候是第二个表格
                let values = Object.values(targetTable);
                //必须取第一个元素
                const fiberNode = values[0]
                const tableRows = fiberNode.memoizedProps.children.props.children[1].props.data

                //获取颜色数据
                const skuColorEle = document.querySelector('#skuValue-颜色分类')
                const colorValues = Object.values(skuColorEle)[0].memoizedProps.children.props.form.value._value
                const colorMap = {}
                colorValues.forEach(colorValue => {
                    colorMap[colorValue.id] = colorValue.name
                })

                //获取发货时间数据
                const timeEle = document.querySelector('div[class*="style_timeSpecCheckboxGroup__"]')
                const timeMap = {}
                if (timeEle) {
                    const timeArr = Object.values(timeEle)[0].memoizedProps.children.props.value.value
                    for (let i = 0; i < timeArr.length; i++) {
                        const item = tableRows[i]
                        const timeId = item.form.value._value.spec_detail_ids[2]
                        timeMap[timeId] = timeArr[i]
                    }
                } else {
                    const item = tableRows[0]
                    const timeId = item.form.value._value.spec_detail_ids[2]
                    timeMap[timeId] = '现货'
                }

                //获取鞋码大小数据
                const skuSizeEle = document.querySelector('#skuValue-鞋码大小')
                const sizeValues = Object.values(skuSizeEle)[0].memoizedProps.children.props.form.value._value
                const sizeMap = {}
                sizeValues.forEach(sizeValue => {
                    sizeMap[sizeValue.id] = sizeValue.name
                })

                // 现代化弹窗生成用户输入区域
                const modal = document.createElement('div')
                modal.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9998;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                `
                modal.innerHTML = `
                    <style>
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    </style>
                    <div style="
                        background: #ffffff;
                        border-radius: 10px;
                        box-shadow: 0 15px 50px rgba(0, 0, 0, 0.25);
                        width: 90%;
                        max-width: 750px;
                        max-height: 60vh;
                        overflow: hidden;
                        display: flex;
                        flex-direction: column;
                    ">
                        <div style="
                            padding: 16px 32px;
                            border-bottom: 1px solid #f0f0f0;
                            background: #2563eb;
                            color: white;
                            text-align: center;
                        ">
                            <h3 style="margin: 0; color: #f0f0f0; font-size: 18px; font-weight: 600;">快速填充商品编码</h3>
                        </div>
                        
                        <div style="flex: 1; overflow-y: auto; padding: 20px 32px;">
                            <div style="
                                display: grid;
                                grid-template-columns: 1fr 1fr 1fr 1fr;
                                gap: 10px;
                                margin-bottom: 12px;
                                padding: 8px 12px;
                                background: #f1f5f9;
                                border-radius: 6px;
                                font-size: 12px;
                                color: #64748b;
                                font-weight: 500;
                            ">
                                <div>颜色分类</div>
                                <div>前缀</div>
                                <div>发货时间</div>
                                <div>后缀</div>
                            </div>
                            
                            <div style="margin-bottom: 16px;">
                                ${Object.keys(colorMap).map(key => {
                    // 为每个颜色获取唯一的发货时间ID列表
                    const uniqueTimeIds = [...new Set(tableRows.filter(row =>
                        row.form.value._value.spec_detail_ids[0] === key
                    ).map(row =>
                        row.form.value._value.spec_detail_ids[2]
                    ))];

                    return `
                                        <div style="
                                            margin-bottom: 16px;
                                            border-radius: 8px;
                                            overflow: hidden;
                                            border: 1px solid #e2e8f0;
                                        ">
                                            <!-- 发货时间后缀列表 - 在第一个时间项显示颜色和前缀 -->
                                            <div style="background: #f8fafc;">
                                                ${uniqueTimeIds.map((timeId, index) => {
                        // 只在第一个发货时间项显示颜色和前缀
                        const isFirstItem = index === 0;
                        return `
                                                        <div style="
                                                            display: grid;
                                                            grid-template-columns: 1fr 1fr 1fr 1fr;
                                                            gap: 10px;
                                                            align-items: center;
                                                            padding: 8px 12px;
                                                            border-bottom: 1px solid #e2e8f0;
                                                            transition: all 0.2s ease;
                                                        " onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
                                                            <div style="${isFirstItem ? 'font-weight: 600; color: #475569;' : ''}">
                                                                ${isFirstItem ? colorMap[key] : ''}
                                                            </div>
                                                            <div>
                                                                ${isFirstItem ? `
                                                                    <input type="text" 
                                                                           class="color-prefix" 
                                                                           data-color="${colorMap[key]}" 
                                                                           data-color-id="${key}" 
                                                                           placeholder="输入前缀"
                                                                           style="
                                                                                   width: 100%;
                                                                                   padding: 5px 8px;
                                                                                   border: 1px solid #d1d5db;
                                                                                   border-radius: 4px;
                                                                                   font-size: 12px;
                                                                                   transition: all 0.2s ease;
                                                                                   background: white;
                                                                               "
                                                                           onfocus="this.style.borderColor='#2563eb'; this.style.boxShadow='0 0 0 2px rgba(37, 99, 235, 0.1)'"
                                                                           onblur="this.style.borderColor='#d1d5db'; this.style.boxShadow='none'">
                                                                ` : ''}
                                                            </div>
                                                            <div style="color: #374151; font-size: 13px;">
                                                                ${timeMap[timeId] || '未知'}
                                                            </div>
                                                            <div>
                                                                <input type="text" 
                                                                       class="color-time-suffix" 
                                                                       data-color-id="${key}" 
                                                                       data-time-id="${timeId}" 
                                                                       data-time-name="${timeMap[timeId] || '未知'}" 
                                                                       placeholder="输入后缀"
                                                                       style="
                                                                           width: 100%;
                                                                           padding: 5px 8px;
                                                                           border: 1px solid #d1d5db;
                                                                           border-radius: 4px;
                                                                           font-size: 12px;
                                                                           transition: all 0.2s ease;
                                                                           background: white;
                                                                       "
                                                                       onfocus="this.style.borderColor='#2563eb'; this.style.boxShadow='0 0 0 2px rgba(37, 99, 235, 0.1)'"
                                                                       onblur="this.style.borderColor='#d1d5db'; this.style.boxShadow='none'">
                                                            </div>
                                                        </div>
                                                    `;
                    }).join('')}
                                            </div>
                                        </div>
                                    `;
                }).join('')}
                            </div>
                        </div>
                        
                        <div style="
                            padding: 16px 32px;
                            border-top: 1px solid #f0f0f0;
                            background: #fafbfc;
                            display: flex;
                            justify-content: center;
                            gap: 12px;
                        ">
                            <button id="cancel-prefixes" style="
                                padding: 8px 16px;
                                font-size: 13px;
                                background: #ffffff;
                                color: #374151;
                                border: 1px solid #d1d5db;
                                border-radius: 6px;
                                cursor: pointer;
                                font-weight: 500;
                                transition: all 0.2s ease;
                            " onmouseover="this.style.background='#f9fafb'; this.style.borderColor='#9ca3af'" onmouseout="this.style.background='#ffffff'; this.style.borderColor='#d1d5db'">
                                取消
                            </button>
                            
                            <button id="submit-prefixes" style="
                                padding: 8px 16px;
                                font-size: 13px;
                                background: #2563eb;
                                color: white;
                                border: none;
                                border-radius: 6px;
                                cursor: pointer;
                                font-weight: 500;
                                transition: all 0.2s ease;
                                position: relative;
                                min-width: 70px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(37, 99, 235, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                                <span id="btn-text" style="display: block;">确定</span>
                                <div id="loading-spinner" style="display: none; position: absolute; top: 25%; left: 30%; transform: translate(-50%, -50%); border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid white; border-radius: 50%; width: 20px; height: 20px; animation: spin 0.8s linear infinite;"></div>
                            </button>
                        </div>
                    </div>
                `
                document.body.appendChild(modal)
                const submitBtn = document.getElementById('submit-prefixes')
                // 确定按钮点击后处理输入的数据
                submitBtn.addEventListener('click', () => {
                    // 显示加载动画
                    document.getElementById('btn-text').style.display = 'none'
                    document.getElementById('loading-spinner').style.display = 'block'
                    const prefixMap = {}
                    const timeSuffixMap = {} // 使用嵌套对象存储颜色-时间对应的后缀

                    // 初始化时间后缀映射
                    Object.keys(colorMap).forEach(colorId => {
                        timeSuffixMap[colorId] = {}
                    })

                    // 收集颜色前缀
                    document.querySelectorAll('.color-prefix').forEach(input => {
                        const colorId = input.getAttribute('data-color-id')
                        prefixMap[colorId] = input.value.trim()
                    })

                    // 收集颜色-时间对应的后缀
                    document.querySelectorAll('.color-time-suffix').forEach(input => {
                        const colorId = input.getAttribute('data-color-id')
                        const timeId = input.getAttribute('data-time-id')
                        timeSuffixMap[colorId][timeId] = input.value.trim()
                    })

                    tableRows.forEach(item => {
                        const colorId = item.form.value._value.spec_detail_ids[0]
                        const sizeId = item.form.value._value.spec_detail_ids[1]
                        const timeId = item.form.value._value.spec_detail_ids[2]

                        // 获取用户输入的前缀和对应时间的后缀
                        const prefix = prefixMap[colorId] || ''
                        const timeSuffix = timeSuffixMap[colorId] && timeSuffixMap[colorId][timeId] ? timeSuffixMap[colorId][timeId] : ''
                        const size = sizeMap[sizeId]
                        const lastProductCode = item.form.value._value.code
                        if (size && (prefix.length > 0 || timeSuffix.length > 0)) {
                            // 构建完整的商品编码
                            let productCode = ''
                            if (prefix.length > 0) {
                                productCode = prefix + size + timeSuffix
                            } else if (timeSuffix.length > 0) {
                                productCode = lastProductCode + timeSuffix
                            }
                            // 填充商品编码
                            item.form.children.code.value._setter(productCode)
                        }
                    })
                    isCompleted = true

                    // 关闭弹窗
                    function checkCompleted() {
                        setTimeout(() => {
                            if (isCompleted) {
                                modal.remove()
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
                    modal.remove()
                })
            })
        }
    }

    // ========== 直播增强 ==========
    class LiveModule extends ModuleBase {
        static moduleId = 'liveModule'
        static moduleConfig = {
            name: '直播列表增强',
            description: '直播列表显示货号、自动讲解功能',
            configFields: [
                { key: 'autoClickOn', label: '自动讲解', type: 'switch', defaultValue: false }
            ]
        }

        constructor(requestListenerManager) {
            super()
            this.requestListenerManager = requestListenerManager
            this.autoClickOn = false
            this.productMap = new Map()
            this.idToBtnMap = new Map()
            this.autoClickInterval = null
            this.skipCount = 0
            this.lastClickedId = null
            this.goodsContainer = null
            this.monitorController = null
            this.listeners = []
            console.log('=====直播增强=====')
        }

        init() {
            console.log('初始化直播增强功能')
            this.autoClickOn = this.getConfig('autoClickOn', false)
            this.setupRequestListeners()
            this.createMonitor()
        }

        destroy() {
            console.log('销毁直播增强模块')

            // 清理自动点击定时器
            if (this.autoClickInterval) {
                clearInterval(this.autoClickInterval)
                this.autoClickInterval = null
            }

            // 清理监听器控制器
            if (this.monitorController) {
                this.monitorController.stop()
                this.monitorController = null
            }

            // 清理请求监听器
            this.listeners.forEach(listenerId => {
                if (this.requestListenerManager) {
                    this.requestListenerManager.removeListener(listenerId)
                }
            })
            this.listeners = []

            // 清理数据
            this.productMap.clear()
            this.idToBtnMap.clear()
            this.lastClickedId = null
            this.goodsContainer = null

            console.log('直播增强模块已销毁')
        }

        setupRequestListeners() {
            // 监听直播商品请求
            const listenerId = this.requestListenerManager.addListener('liveProducts', /\/api\/anchor\/livepc\/promotions_v2\?list_type=1&source_type=force/, (url, responseText) => {
                setTimeout(() => {
                    try {
                        this.updateProductMap(JSON.parse(responseText))
                    } catch (error) {
                        console.error('解析直播商品数据失败:', error)
                    }
                }, 500)
            })
            this.listeners.push(listenerId)
        }

        // 创建开关控件
        createToggleSwitch() {
            const toggleContainer = document.createElement('div')
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
            const filterLive = document.querySelector('.live-control-filter-live')
            const filterHeader = filterLive.querySelector('div[class^="header-"]')
            if (filterHeader) {
                filterHeader.insertBefore(toggleContainer, filterHeader.lastChild)
            }

            // 保存DOM引用
            this.toggleElements = { checkbox, slider, statusText }
        }

        // 开关功能切换
        toggleFunctionality(isEnabled) {
            this.autoClickOn = isEnabled
            this.lastClickedId = null
            this.refreshGoodsItems()
            console.log(`自动讲解：${isEnabled ? '开启' : '关闭'}`)
            ConfigManager.getInstance().setModuleConfig('liveModule', 'autoClickOn', isEnabled)
            ConfigManager.getInstance().saveConfig()
        }

        // 更新商品映射
        updateProductMap(productListRes) {
            if (!productListRes || !productListRes.data || !productListRes.data.promotions) {
                console.warn('直播商品数据格式不正确')
                return
            }

            for (let i = 0; i < productListRes.data.promotions.length; i++) {
                const product = productListRes.data.promotions[i]
                if (product.promotion_id && product.art_no) {
                    this.productMap.set(product.promotion_id, product.art_no)
                }
            }
            this.refreshGoodsItems()
        }

        // 创建监听器
        createMonitor() {
            Utils.waitForElementByXPath("//*[@id='live-control-goods-list-container']", 30000).then((element) => {
                this.goodsContainer = element
                this.createToggleSwitch()
                this.monitorController = Utils.observeElementChanges(element.children[0].children[0], {
                    childList: true,
                    attributes: false,
                    subtree: false,
                    waitForElement: true,      // 等待元素出现
                    waitTimeout: 30000,        // 30秒超时
                    waitInterval: 1000,        // 1秒检查间隔
                    debounce: 100,             // 100ms防抖
                    immediate: false,
                    autoStart: true
                }, (mutations, observer, element) => {
                    console.log('检测到商品列表变化，刷新商品项...')
                    this.refreshGoodsItems()
                })
            })
            console.log('Creating MutationObserver with observeElementChanges...')
        }

        // 设置按钮文本
        setButtonText(id, text) {
            const btn = this.idToBtnMap.get(id)
            if (btn) {
                btn.textContent = text
            }
        }

        // 刷新商品项
        refreshGoodsItems() {
            if (!this.goodsContainer) {
                return
            }
            const goodsItems = this.goodsContainer.querySelectorAll('.rpa_lc__live-goods__goods-item')
            goodsItems.forEach(item => {
                // 增加货号显示
                const productId = item.getAttribute('data-rbd-draggable-id')
                const code = this.productMap.get(productId)

                if (code) {
                    const goodsTextContainer = item.querySelector('div[class^="right-"]')
                    if (goodsTextContainer) {
                        let goodsCodeDiv = goodsTextContainer.querySelector('[id="goodsCode"]')
                        if (!goodsCodeDiv) {
                            goodsCodeDiv = document.createElement('div')
                            goodsCodeDiv.id = 'goodsCode'
                            goodsCodeDiv.style.color = '#565960'
                            goodsCodeDiv.style.fontSize = '12px'
                            goodsCodeDiv.style.marginTop = '2px'
                            goodsCodeDiv.style.cursor = 'pointer'
                            goodsCodeDiv.dataset.code = code
                            goodsTextContainer.appendChild(goodsCodeDiv)

                            // 使用 Utils.copyToClipboard 复用公共方法
                            goodsCodeDiv.addEventListener('click', () => {
                                Utils.copyToClipboard(goodsCodeDiv.dataset.code)
                            })
                        }
                        goodsCodeDiv.textContent = `货号: ${code}`
                    }
                }

                // 实现自动讲解
                if (!this.autoClickOn) {
                    return
                }

                // 按钮设置事件
                let buttons = item.querySelectorAll('.auxo-btn.auxo-btn-sm.lvc2-doudian-btn')
                if (buttons.length === 0) {
                    buttons = item.querySelectorAll('.lvc2-grey-btn')
                }

                buttons.forEach(button => {
                    const buttonText = button.textContent.trim()
                    if (buttonText.includes('讲解') && button.getAttribute('cus-jiangjie') !== 'true') {
                        button.setAttribute('cus-jiangjie', 'true')
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
                                const currentId = parentItem ? parentItem.getAttribute('data-rbd-draggable-id') : null

                                if (currentId === this.lastClickedId) {
                                    this.setButtonText(currentId, '自动讲解')
                                    this.lastClickedId = null
                                } else {
                                    if (this.lastClickedId) {
                                        this.setButtonText(this.lastClickedId, '自动讲解')
                                    }
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
                    this.autoClickInterval = null
                }
            }, 2000)
        }

    }

    // ========== 直播数据登记 ===========
    class LiveScreenModule extends ModuleBase {
        static moduleId = 'liveScreenModule'
        static moduleConfig = {
            name: '直播大屏模块',
            description: '直播大屏数据登记',
            configFields: [
                { key: 'tableId', label: '数据文档ID', placeholder: '请输入数据文档ID' },
                { key: 'conversationId', label: '通知群聊ID', placeholder: '请输入通知群聊ID' }
            ]
        }

        constructor(requestListenerManager) {
            super()
            this.requestListenerManager = requestListenerManager
            this.listeners = []
            //核心数据
            this.coreData = {}
            //主播列表
            this.anchorList = []
            //主播数据列表
            this.anchorDataList = []
            //主播排班列表
            this.anchorShiftList = []
            //请求参数
            this.requestParams = {}
            console.log('=====直播大屏数据登记=====')
        }

        init() {
            console.log('初始化直播大屏数据登记功能')
            this.setCoreDataSelected()
            this.setupRequestListeners()
            //等待
            Utils.waitForElementByXPath("//div[contains(@class,'container--') and contains(normalize-space(.), '主播分析')]", 5000).then(headerContainer => {
                this.bindAnchorAnalysisListener()
            })

        }

        destroy() {
            console.log('销毁直播大屏数据登记模块')
            // 清理请求监听器
            this.listeners.forEach(listenerId => {
                if (this.requestListenerManager) {
                    this.requestListenerManager.removeListener(listenerId)
                }
            })
            this.listeners = []

            console.log('直播大屏数据登记模块已销毁')
        }

        // 设置核心数据选项
        setCoreDataSelected() {
            localStorage.setItem('COMPASS_LIVE_SCEEN_CORE_INDICATORS_COUPON_SHOP_HIT', '["stat_cost","real_refund_amt","gpm","avg_watch_duration","live_show_cnt","watch_ucnt","pay_ucnt","pay_combo_cnt","watch_cnt_show_ratio","watch_pay_ucnt_ratio","product_click_pay_ucnt_ratio","follow_anchor_ucnt"]')
            localStorage.setItem('COMPASS_LIVE_SCEEN_CORE_INDICATORS_COUPON_SHOP-OFFICIAL_HIT', '["stat_cost","real_refund_amt","gpm","avg_watch_duration","live_show_cnt","watch_ucnt","pay_ucnt","pay_combo_cnt","live_show_watch_cnt_ratio","watch_pay_ucnt_ratio","product_click_pay_ucnt_ratio","follow_anchor_ucnt"]')
        }

        setupRequestListeners() {
            // 监听直播商品请求
            //如果当前页面url包含official，则是官方直播间
            let liveCoreDataRegex = /\/compass_api\/shop\/live\/live_screen\/core_data/
            let liveAnchorDataListRegex = /\/compass_api\/shop\/live\/live_screen\/anchor_lidar_detail/
            if (window.location.href.includes('shop-official')) {
                liveCoreDataRegex = /\/compass_api\/content_live\/shop_official\/live_screen\/core_data/
                liveAnchorDataListRegex = /\/compass_api\/content_live\/shop_official\/live_screen\/anchor_lidar_detail/
            }

            const listenerId = this.requestListenerManager.addListener('liveCoreData', liveCoreDataRegex, (url, responseText) => {
                setTimeout(() => {
                    try {
                        //从url中提取参数 转成对象
                        this.requestParams = Object.fromEntries(new URLSearchParams(url.split('?')[1]))
                        const data = JSON.parse(responseText).data
                        const coreData = data?.core_data || []
                        this.coreData = {
                            "直播ID": this.requestParams.room_id,
                            "直播间成交金额": Utils.formatNumber(data.pay_amt.value / 100),
                            "投放消耗": Utils.formatNumber(coreData.find(item => item.index_name === 'stat_cost').value.value / 100),
                            "退款金额": Utils.formatNumber(coreData.find(item => item.index_name === 'real_refund_amt').value.value / 100),
                            "千次观看用户成交金额": Utils.formatNumber(coreData.find(item => item.index_name === 'gpm').value.value / 100),
                            "人均观看时长": coreData.find(item => item.index_name === 'avg_watch_duration').value.value,
                            "曝光次数": coreData.find(item => item.index_name === 'live_show_cnt').value.value,
                            "累计观看人数": coreData.find(item => item.index_name === 'watch_ucnt').value.value,
                            "成交人数": coreData.find(item => item.index_name === 'pay_ucnt').value.value,
                            "成交件数": coreData.find(item => item.index_name === 'pay_combo_cnt').value.value,
                            "曝光-观看率(次数)": Utils.formatNumber(coreData.find(item => item.index_display === '曝光-观看率(次数)').value.value * 100) + '%',
                            "观看-成交率(人数)": Utils.formatNumber(coreData.find(item => item.index_name === 'watch_pay_ucnt_ratio').value.value * 100) + '%',
                            "商品点击-成交率(人数)": Utils.formatNumber(coreData.find(item => item.index_name === 'product_click_pay_ucnt_ratio').value.value * 100) + '%',
                            "新增粉丝数": coreData.find(item => item.index_name === 'follow_anchor_ucnt').value.value,
                        }
                        // console.log('更新直播大屏核心数据:', this.coreData)

                    } catch (error) {
                        console.error('解析直播大屏核心数据失败:', error)
                    }
                }, 500)
            })
            this.listeners.push(listenerId)

            const anchorDataListenerId = this.requestListenerManager.addListener('liveAnchorDataList', liveAnchorDataListRegex, (url, responseText) => {
                setTimeout(() => {
                    try {
                        const data = JSON.parse(responseText)
                        // console.log("直播大屏主播个人数据:", data)
                        const infoData = data.data?.info_list || []
                        this.anchorDataList = infoData
                    } catch (error) {
                        console.error('解析直播大屏主播数据失败:', error)
                    }
                }, 500)
            })
            this.listeners.push(anchorDataListenerId)

            const anchorShiftListenerId = this.requestListenerManager.addListener('liveAnchorShiftData', /\/compass_api\/shop\/live\/live_screen\/anchor_shift_list/, (url, responseText) => {
                setTimeout(() => {
                    try {
                        const data = JSON.parse(responseText)
                        // console.log("直播大屏主播排班数据:", data)
                        this.anchorShiftList = data.data?.info_list || []
                    } catch (error) {
                        console.error('解析直播大屏主播排班数据失败:', error)
                    }
                }, 500)
            })
            this.listeners.push(anchorShiftListenerId)
        }

        bindAnchorAnalysisListener() {
            const divs = document.querySelectorAll('div[class*="tab--"]:not([class*="active--"])');
            divs.forEach(div => {
                if (div.innerText.includes('主播分析')) {
                    // 防止重复绑定
                    if (div.__binded) return;
                    div.__binded = true;
                    div.addEventListener('click', (e) => {
                        this.createReportBtn()
                    });
                }
            });
        }

        createReportBtn() {
            const existingBtn = document.getElementById('report-anchor-data-btn')
            if (existingBtn) return
            const reportBtn = document.createElement('button')
            reportBtn.id = 'report-anchor-data-btn'
            reportBtn.innerText = "登记主播数据"
            // 合并样式
            reportBtn.style.padding = '4px 10px'
            reportBtn.style.marginRight = '10px'
            reportBtn.style.backgroundColor = 'rgb(68 90 254)'
            reportBtn.style.color = 'white'
            reportBtn.style.border = 'none'
            reportBtn.style.borderRadius = '3px'
            reportBtn.style.cursor = 'pointer'
            reportBtn.style.fontSize = '18px'
            reportBtn.style.fontWeight = '400'
            // 添加hover 样式
            reportBtn.style.transition = 'background-color 0.3s ease'
            reportBtn.addEventListener('mouseover', () => {
                reportBtn.style.backgroundColor = 'rgb(44 68 243)'
            })
            reportBtn.addEventListener('mouseout', () => {
                reportBtn.style.backgroundColor = 'rgb(68 90 254)'
            })

            reportBtn.addEventListener('click', async () => {
                const modal = await this.showAnchorSelectModal()
                modal.onSubmit(async (anchorValue, anchorName) => {
                    // 提交数据
                    await this.submitAnchorData(anchorName)
                    modal.close()
                })
            })
            //等待
            Utils.waitForElementByXPath("//div[contains(@class,'content--')]//div[contains(@class,'container--')]//div[contains(@class,'control--')]", 5000).then(headerContainer => {
                headerContainer.appendChild(reportBtn)
            })
        }

        async showAnchorSelectModal() {
            // 先获取主播列表
            await this.getAnchorList()



            // 创建遮罩层
            const overlay = document.createElement('div');
            overlay.id = 'anchor-select-modal-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0px;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 100000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            `;
            // 添加旋转动画的CSS（确保动画可用）
            const style = document.createElement('style');
            style.id = 'anchor-select-modal-styles';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);


            // 创建弹窗容器
            const modal = document.createElement('div');
            modal.id = 'anchor-select-modal';
            modal.style.cssText = `
                background: rgb(58, 66, 88);
                border-radius: 8px;
                width: 300px;
                max-width: 90%;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
                overflow: visible;
            `;

            // 弹窗头部
            const header = document.createElement('div');
            header.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 5px 16px 5px 16px;
                border-bottom: 1px solid #494f6b;
            `;

            const title = document.createElement('h3');
            title.textContent = '选择当前主播';
            title.style.cssText = `
                margin: 0;
                font-size: 15px;
                font-weight: 600;
                color: #f9fafb;
            `;

            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '×';
            closeBtn.style.cssText = `
                background: none;
                border: none;
                color: #9ca3af;
                font-size: 22px;
                cursor: pointer;
                padding: 0;
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
                transition: all 0.2s;
            `;
            closeBtn.onmouseover = () => {
                closeBtn.style.backgroundColor = '#374151';
                closeBtn.style.color = '#f9fafb';
            };
            closeBtn.onmouseout = () => {
                closeBtn.style.backgroundColor = 'transparent';
                closeBtn.style.color = '#9ca3af';
            };

            header.appendChild(title);
            header.appendChild(closeBtn);

            // 弹窗内容
            const content = document.createElement('div');
            content.style.cssText = `
                padding: 10px 16px;
            `;
            // 创建自定义下拉框容器
            const customSelectContainer = document.createElement('div');
            customSelectContainer.style.cssText = `
                position: relative;
                width: 100%;
            `;

            // 创建下拉框显示区域
            const selectDisplay = document.createElement('div');
            selectDisplay.style.cssText = `
                width: 100%;
                padding: 5px 10px;
                background: #111827;
                border: 1px solid #374151;
                border-radius: 6px;
                font-size: 15px;
                color: #f9fafb;
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
                box-sizing: border-box;
            `;

            // 选中的文本
            const selectedText = document.createElement('span');
            selectedText.textContent = '请选择主播';
            selectedText.style.cssText = `
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            `;

            // 下拉箭头
            const arrow = document.createElement('span');
            arrow.innerHTML = '▼';
            arrow.style.cssText = `
                font-size: 10px;
                color: #9ca3af;
                margin-left: 8px;
                transition: transform 0.2s;
            `;

            selectDisplay.appendChild(selectedText);
            selectDisplay.appendChild(arrow);

            // 创建下拉选项列表
            const optionsList = document.createElement('div');
            optionsList.style.cssText = `
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                margin-top: 4px;
                background: #1f2937;
                border: 1px solid #374151;
                border-radius: 6px;
                max-height: 200px;
                overflow-y: auto;
                z-index: 100001;
                display: none;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
                scrollbar-width: thin;
                scrollbar-color: #4b5563 #1f2937;
            `;

            // 添加自定义滚动条样式
            const scrollbarStyle = document.createElement('style');
            scrollbarStyle.textContent = `
                #anchor-select-options::-webkit-scrollbar {
                    width: 6px;
                }
                #anchor-select-options::-webkit-scrollbar-track {
                    background: #1f2937;
                    border-radius: 3px;
                }
                #anchor-select-options::-webkit-scrollbar-thumb {
                    background: #4b5563;
                    border-radius: 3px;
                }
                #anchor-select-options::-webkit-scrollbar-thumb:hover {
                    background: #6b7280;
                }
            `;
            document.head.appendChild(scrollbarStyle);
            optionsList.id = 'anchor-select-options';

            // 存储当前选中的值
            let selectedValue = '';
            let selectedName = '';

            // 创建选项的函数
            const createOption = (value, text) => {
                const option = document.createElement('div');
                option.style.cssText = `
                    padding: 8px 10px;
                    font-size: 12px;
                    color: #f9fafb;
                    cursor: pointer;
                    border-bottom: 1px solid #494f6b;
                    transition: background-color 0.2s;
                `;
                option.textContent = text;
                option.dataset.value = value;

                option.addEventListener('mouseenter', () => {
                    option.style.backgroundColor = '#374151';
                });
                option.addEventListener('mouseleave', () => {
                    option.style.backgroundColor = 'transparent';
                });
                option.addEventListener('click', () => {
                    selectedValue = value;
                    selectedName = text;
                    selectedText.textContent = text;
                    optionsList.style.display = 'none';
                    arrow.style.transform = 'rotate(0deg)';
                    selectDisplay.style.borderColor = '#374151';
                });

                return option;
            };

            // 填充主播列表选项
            let hasAnchor = false;
            this.anchorList.forEach(anchor => {
                const index = this.anchorDataList.findIndex(item => item.name === anchor.name);
                if (index === -1) return;
                hasAnchor = true;
                const value = anchor.name;
                const text = anchor.name;
                optionsList.appendChild(createOption(value, text));
            });
            if (!hasAnchor) {
                UI.showMessage("error", '请先配置主播排班信息');
            }
            // 添加"其它"选项
            // optionsList.appendChild(createOption('other', '其它'));

            // 点击显示区域展开/收起下拉列表
            selectDisplay.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = optionsList.style.display === 'block';
                if (isOpen) {
                    optionsList.style.display = 'none';
                    arrow.style.transform = 'rotate(0deg)';
                    selectDisplay.style.borderColor = '#374151';
                } else {
                    optionsList.style.display = 'block';
                    arrow.style.transform = 'rotate(180deg)';
                    selectDisplay.style.borderColor = '#3b82f6';
                }
            });

            // 点击外部关闭下拉列表
            document.addEventListener('click', (e) => {
                if (!customSelectContainer.contains(e.target)) {
                    optionsList.style.display = 'none';
                    arrow.style.transform = 'rotate(0deg)';
                    selectDisplay.style.borderColor = '#374151';
                }
            });

            customSelectContainer.appendChild(selectDisplay);
            customSelectContainer.appendChild(optionsList);
            content.appendChild(customSelectContainer);

            // 弹窗底部
            const footer = document.createElement('div');
            footer.style.cssText = `
                display: flex;
                justify-content: space-between;
                gap: 8px;
                padding: 5px 16px 10px 16px;
                border-top: 1px solid #374151;
            `;

            // 取消按钮
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = '取消';
            cancelBtn.style.cssText = `
                padding: 2px 10px;
                background: transparent;
                color: #9ca3af;
                border: none;
                border-radius: 3px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s;
            `;
            cancelBtn.onmouseover = () => {
                cancelBtn.style.backgroundColor = '#374151';
                cancelBtn.style.color = '#f9fafb';
            };
            cancelBtn.onmouseout = () => {
                cancelBtn.style.backgroundColor = 'transparent';
                cancelBtn.style.color = '#9ca3af';
            };

            // 提交按钮
            const submitBtn = document.createElement('button');
            submitBtn.textContent = '提交';
            submitBtn.style.cssText = `
                padding: 2px 10px;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 3px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s;
            `;
            submitBtn.onmouseover = () => {
                submitBtn.style.backgroundColor = '#2563eb';
            };
            submitBtn.onmouseout = () => {
                submitBtn.style.backgroundColor = '#3b82f6';
            };
            const tips = document.createElement('span');
            tips.textContent = '请先配置主播排班信息';
            tips.style.color = '#9ca3af';
            tips.style.fontSize = '12px';
            tips.style.width = '60%';
            const spinner = document.createElement('span');
            //spinner实现转圈加载动画
            spinner.style.cssText = `
                        display: inline-block;
                        margin-left: 5px;
                        width: 12px;
                        height: 12px;
                        border: 2px solid #f9fafb;
                        border-top-color: transparent;
                        border-radius: 50%;
                        animation: spin 0.6s linear infinite;
                    `;
            footer.appendChild(tips);
            tips.style.opacity = '0';
            if (!hasAnchor) {
                tips.style.opacity = '1';
                submitBtn.style.cursor = 'not-allowed';
                submitBtn.disabled = true;
            }

            footer.appendChild(cancelBtn);
            footer.appendChild(submitBtn);

            // 组装弹窗
            modal.appendChild(header);
            modal.appendChild(content);
            modal.appendChild(footer);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // 关闭弹窗函数
            const closeModal = () => {
                overlay.remove();
            };

            // 事件绑定
            closeBtn.addEventListener('click', closeModal);
            cancelBtn.addEventListener('click', closeModal);
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    closeModal();
                }
            });

            submitBtn.addEventListener('click', () => {
                if (selectedValue === '') {
                    tips.textContent = '请选择主播';
                    tips.style.opacity = '1';
                    return
                } else {
                    tips.style.opacity = '0';
                }
                // 触发回调
                try {
                    if (this.onAnchorSelectedSubmit) {
                        // tips 提示提交中， 增加转圈加载动画
                        tips.textContent = '提交中...';
                        tips.style.opacity = '1';
                        tips.style.color = '#f9fafb';
                        tips.appendChild(spinner);
                        this.onAnchorSelectedSubmit(selectedValue, selectedName);
                    }
                } catch (error) {
                    console.error('提交失败:', error);
                    UI.showMessage('error', '提交失败:' + error.message);
                    tips.textContent = '提交失败！';
                    tips.style.opacity = '1';
                    tips.style.color = '#f9fafb';
                }
            });

            // 返回关闭方法和选择回调设置
            return {
                close: closeModal,
                onSubmit: (callback) => {
                    this.onAnchorSelectedSubmit = callback;
                }
            };
        }

        async getAnchorList() {
            //模拟发送请求 
            // 使用requestParams 构造请求链接
            const url = "https://compass.jinritemai.com/compass_api/shop/live/live_screen/anchor_binding" +
                "?room_id=" + this.requestParams.room_id +
                "&_lid=" + this.requestParams._lid +
                "&verifyFp=" + this.requestParams.verifyFp +
                "&fp=" + this.requestParams.fp +
                "&msToken=" + this.requestParams.msToken +
                "&a_bogus=" + this.requestParams.a_bogus;
            const res = await Utils.sendHttpRequest("GET", url)
            this.anchorList = JSON.parse(res).data?.info_list || []
        }

        async submitAnchorData(anchorName) {
            // 从后向前查找最后一个名字符合的主播
            const anchorData = this.anchorDataList.slice().reverse().find(anchor => anchor.name === anchorName)
            const anchorShiftData = this.anchorShiftList.slice().reverse().find(anchor => anchor.name === anchorName)
            const startDate = Utils.formatTimestamp(anchorShiftData.live_start_ts * 1000, 'YYYY-MM-DD')
            // 合并数据
            const mergedData = {
                "主播名称": anchorName,
                "直播日期": startDate,
                "开始时间": Utils.formatTimestamp(anchorShiftData.live_start_ts * 1000, 'HH:mm'),
                "结束时间": Utils.formatTimestamp(anchorShiftData.live_end_ts * 1000, 'HH:mm'),
                "直播时长": Utils.formatDuration(anchorData.duration),
                "最高在线人数": anchorData.max_online_cnt.value,
                "平均在线人数": Utils.formatNumber(anchorData.avg_online_cnt.value),
                "用户支付金额": Utils.formatNumber(anchorData.pay_amt.value / 100),
                ...this.coreData
            }
            this.screenshotAndSend(mergedData["主播名称"], startDate, mergedData["开始时间"], mergedData["结束时间"])
            // 获取历史数据
            const tableId = this.getConfig("tableId")
            const conversationId = this.getConfig("conversationId")
            if (!tableId || !conversationId) {
                UI.showMessage("error", "请先检查模块参数，设置数据登记表格和通知群聊！")
                return
            }
            console.log("tableId:", tableId)
            const timestampParts = Utils.getTimestampParts(anchorShiftData.live_start_ts * 1000)
            const sheetName = `${timestampParts.yearShort}年${timestampParts.month}月`
            let sheetId = await DingTalkSDK.getSheetIdByName(tableId, sheetName)
            if (!sheetId) {
                console.error('未找到对应的工作表:', sheetName)
                //创建工作表
                sheetId = await this.initSheet(sheetName)
            }
            const findRes = await DingTalkSDK.findRowByColumnValue(tableId, sheetId, 'A', startDate, { format: 'date' })
            const startRow = findRes?.rowIndex || 0
            console.log('查询日期:', sheetName, startDate, startRow)
            let writeRow = startRow
            let writeData = mergedData
            if (findRes.find) {
                console.log('已存在数据:', findRes)
                const range = await DingTalkSDK.getRange(tableId, sheetId, `A${startRow}:AA${startRow + 3}`)
                const values = range.values
                console.log('查询工作表:', values)
                let sameLiveRoomIdLastRow = []
                values.forEach((row, index) => {
                    if (row[row.length - 1] === mergedData["直播ID"]) {
                        sameLiveRoomIdLastRow = row
                    }
                    if (row[6] !== '') {
                        writeRow = index + startRow + 1
                    }
                })
                //已有当前直播的数据，说明前面已有排班主播，需要进行数据计算。
                if (sameLiveRoomIdLastRow.length > 0) {
                    writeData["直播间成交金额"] = mergedData["直播间成交金额"] - Number(sameLiveRoomIdLastRow[6])
                    writeData["投放消耗"] = mergedData["投放消耗"] - Number(sameLiveRoomIdLastRow[9])
                    writeData["退款金额"] = mergedData["退款金额"] - Number(sameLiveRoomIdLastRow[11])
                    writeData["曝光次数"] = mergedData["曝光次数"] - Number(sameLiveRoomIdLastRow[15])
                    writeData["累计观看人数"] = mergedData["累计观看人数"] - Number(sameLiveRoomIdLastRow[17])
                    writeData["成交件数"] = mergedData["成交件数"] - Number(sameLiveRoomIdLastRow[18])
                    writeData["成交人数"] = mergedData["成交人数"] - Number(sameLiveRoomIdLastRow[19])
                    writeData["新增粉丝数"] = mergedData["新增粉丝数"] - Number(sameLiveRoomIdLastRow[23])
                }
            }
            // writeData全部转换为字符串
            for (const key in writeData) {
                writeData[key] = writeData[key].toString()
            }
            const postData = {
                "values": [
                    [startDate, writeData["主播名称"], "旗舰店", "无", `${writeData["开始时间"]}-${writeData["结束时间"]}`, writeData["直播时长"], writeData["直播间成交金额"], writeData["用户支付金额"], writeData["退款金额"], writeData["投放消耗"], "", "", writeData["千次观看用户成交金额"], writeData["最高在线人数"], writeData["平均在线人数"],
                        writeData["曝光次数"], writeData["曝光-观看率(次数)"], writeData["累计观看人数"], writeData["成交件数"], writeData["成交人数"], "", writeData["观看-成交率(人数)"], writeData["商品点击-成交率(人数)"], writeData["新增粉丝数"], writeData["人均观看时长"], '', writeData["直播ID"]]
                ],
            }
            console.log('插入数据:', writeRow, postData)
            const res = await DingTalkSDK.updateRange(tableId, sheetId, `A${writeRow}:AA${writeRow}`, postData)
            console.log('插入数据结果:', res)
            if (findRes.find) {
                //合并单元格
                const mergeResult = await DingTalkSDK.mergeRange(tableId, sheetId, `A${startRow}:A${writeRow}`, 'mergeAll')
                console.log('合并结果:', mergeResult)
            }
            UI.showMessage("success", "主播数据登记成功！")
        }

        /**
         * 初始化工作表
         * @param {string} sheetName - 工作表名称
         * @returns {Promise<string>} - 工作表ID
         */
        async initSheet(sheetName) {
            const newSheet = await DingTalkSDK.createSheet(tableId, sheetName)
            sheetId = newSheet.id
            const header = ['日期', '主播', '账号', '中控', '直播时间', '直播时长', '直播间成交金额', '用户支付金额', '退款金额', '付费', 'ROI', '有效ROI', '千次观看成交金额', '最高在线人数', '平均在线人数',
                '直播间曝光次数', '曝光观看率', '累计观看人数', '成交件数', '成交人数', '观看-成交率(计算)', '观看-成交率(最终)', '点击成交转化率（人数）', '涨粉数', '人均观看时长', 'UV价值', '直播ID']
            const body = {
                "values": [header],
            }
            await DingTalkSDK.updateRange(tableId, sheetId, 'A1:AA1', body)
            return sheetId
        }

        /**
         * 截图数据并发送到群聊
         */
        async screenshotAndSend(anchorName, date, startTime, endTime) {
            const conversationId = this.getConfig("conversationId")
            const canvas = await Utils.captureWithoutIds(document.documentElement, ['anchor-select-modal-overlay'])
            canvas.toBlob(async imageBlob => {
                console.log("截图成功，开始上传！");
                const result = await DingTalkSDK.uploadMedia('image', imageBlob, 'image.jpg');
                console.log("上传成功：", result);
                const messageContent = `{"title":"直播数据截图","text": "【直播数据截图】 <br/> 主播：${anchorName} <br/> 时间：${date} ${startTime}-${endTime} ![image](${result.mediaId})"}`;
                const groupMsg = await DingTalkSDK.sendGroupMessage({
                    msgKey: 'sampleMarkdown',
                    msgParam: messageContent,
                    openConversationId: conversationId
                });
                console.log('截图发送成功:', groupMsg);
            });
        }
    }

    // ========== 运营工具功能类 ==========
    // 竞店数据获取
    class CompetingStoreDataModule extends ModuleBase {
        static moduleId = 'competingStoreData'
        static moduleConfig = {
            name: '竞店数据抓取',
            description: '抓取竞店数据到飞书文档',
            configFields: [
                { key: 'feishuDocId', label: '飞书文档ID', placeholder: '请输入飞书文档ID' }
            ]
        }

        constructor(requestManager) {
            super()
            this.sheetToken = this.getConfig("feishuDocId")
            this.requestManager = requestManager
            this.targetDataArr = [
                {
                    'channel_name': '不限',
                    'content_type': '0',
                    'pay_amt': '',
                    'own_ratio': '',
                    'channel_ratio': '100%',
                    'pay_cnt': '',
                    'pay_per_usr_price': '',
                    'product_show_ucnt': '',
                    'product_click_ucnt': '',
                    'product_pay_ucnt': '',
                    'product_show_click_ucnt_ratio': '',
                    'product_click_pay_ucnt_ratio': '',
                    'category_ratio': []
                },
                {
                    'channel_name': '直播',
                    'content_type': '1',
                    'pay_amt': '',
                    'own_ratio': '',
                    'channel_ratio': '0%',
                    'pay_cnt': '',
                    'pay_per_usr_price': '',
                    'product_show_ucnt': '',
                    'product_click_ucnt': '',
                    'product_pay_ucnt': '',
                    'product_show_click_ucnt_ratio': '',
                    'product_click_pay_ucnt_ratio': '',
                    'category_ratio': []
                },
                {
                    'channel_name': '短视频',
                    'content_type': '2',
                    'pay_amt': '',
                    'own_ratio': '',
                    'channel_ratio': '0%',
                    'pay_cnt': '',
                    'pay_per_usr_price': '',
                    'product_show_ucnt': '',
                    'product_click_ucnt': '',
                    'product_pay_ucnt': '',
                    'product_show_click_ucnt_ratio': '',
                    'product_click_pay_ucnt_ratio': '',
                    'category_ratio': []
                },
                {
                    'channel_name': '商品卡',
                    'content_type': '3',
                    'pay_amt': '',
                    'own_ratio': '',
                    'channel_ratio': '0%',
                    'pay_cnt': '',
                    'pay_per_usr_price': '',
                    'product_show_ucnt': '',
                    'product_click_ucnt': '',
                    'product_pay_ucnt': '',
                    'product_show_click_ucnt_ratio': '',
                    'product_click_pay_ucnt_ratio': '',
                    'category_ratio': []
                },
                {
                    'channel_name': '图文',
                    'content_type': '6',
                    'pay_amt': '',
                    'own_ratio': '',
                    'channel_ratio': '0%',
                    'pay_cnt': '',
                    'pay_per_usr_price': '',
                    'product_show_ucnt': '',
                    'product_click_ucnt': '',
                    'product_pay_ucnt': '',
                    'product_show_click_ucnt_ratio': '',
                    'product_click_pay_ucnt_ratio': '',
                    'category_ratio': []
                }
            ]
            this.shopId = 0
            this.listeners = []
        }

        init() {
            this.listenTargetRequest()
        }

        checkDataAndAddSubmitBtn() {
            for (let i = 0; i < this.targetDataArr.length; i++) {
                if (this.targetDataArr[i].pay_amt === '' || this.targetDataArr[i].product_show_click_ucnt_ratio === '')
                    return false
            }
            console.log('数据已采集完成', this.targetDataArr)
            UI.addFloatingButton({
                text: '采集数据',
                style: {},
                onClick: () => this.writeDataToFeiShuOnlineExcel(this.targetDataArr)
            })
        }

        listenTargetRequest() {
            const listenerId1 = this.requestManager.addListener('shop_core_data', /https:\/\/compass\.jinritemai\.com\/compass_api\/shop\/mall\/market\/shop_core_data?.*/, (url, data) => {
                let coreData = JSON.parse(data)['data']['module_data']['core_data']
                let contentType = Utils.getQueryParam(url, 'content_type')
                let targetData = this.targetDataArr.find(data => data.content_type === contentType);
                this.shopId = Utils.getQueryParam(url, 'shop_id')

                if (Utils.getQueryParam(url, 'index_selected') === 'pay_amt,pay_cnt,pay_per_usr_price') {
                    let cardData = coreData['compass_general_multi_index_card_value']['data'][0]
                    if (cardData) {
                        targetData.pay_amt = `${Utils.convertToWanString(cardData.pay_amt.extension.lower.value.value / 100)}-${Utils.convertToWanString(cardData.pay_amt.extension.upper.value.value / 100)}`
                        targetData.own_ratio = `${Utils.covertToBaiFenString(cardData.pay_amt.extension.value_ratio_lower.value.value)}-${Utils.covertToBaiFenString(cardData.pay_amt.extension.value_ratio_upper.value.value)}`
                        targetData.pay_cnt = `${Utils.convertToWanString(cardData.pay_cnt.extension.lower.value.value)}-${Utils.convertToWanString(cardData.pay_cnt.extension.upper.value.value)}`
                        targetData.pay_per_usr_price = `${Utils.convertToWanString(cardData.pay_per_usr_price.extension.lower.value.value / 100)}-${Utils.convertToWanString(cardData.pay_per_usr_price.extension.upper.value.value / 100)}`
                    } else {
                        targetData.pay_amt = '-'
                        targetData.own_ratio = '-'
                        targetData.pay_cnt = '-'
                        targetData.pay_per_usr_price = '-'
                    }
                }

                if (Utils.getQueryParam(url, 'index_selected') === 'product_show_ucnt,product_click_ucnt,product_pay_ucnt,product_show_click_ucnt_ratio,product_click_pay_ucnt_ratio') {
                    let cardData = coreData['compass_general_multi_index_card_value']['data'][0]
                    if (cardData) {
                        targetData.product_show_ucnt = `${Utils.convertToWanString(cardData.product_show_ucnt.extension.lower.value.value)}-${Utils.convertToWanString(cardData.product_show_ucnt.extension.upper.value.value)}`
                        targetData.product_click_ucnt = `${Utils.convertToWanString(cardData.product_click_ucnt.extension.lower.value.value)}-${Utils.convertToWanString(cardData.product_click_ucnt.extension.upper.value.value)}`
                        targetData.product_pay_ucnt = `${Utils.convertToWanString(cardData.product_pay_ucnt.extension.lower.value.value)}-${Utils.convertToWanString(cardData.product_pay_ucnt.extension.upper.value.value)}`
                        targetData.product_show_click_ucnt_ratio = `${Utils.covertToBaiFenString(cardData.product_show_click_ucnt_ratio.extension.lower.value.value)}-${Utils.covertToBaiFenString(cardData.product_show_click_ucnt_ratio.extension.upper.value.value)}`
                        targetData.product_click_pay_ucnt_ratio = `${Utils.covertToBaiFenString(cardData.product_click_pay_ucnt_ratio.extension.lower.value.value)}-${Utils.covertToBaiFenString(cardData.product_click_pay_ucnt_ratio.extension.upper.value.value)}`
                    } else {
                        targetData.product_show_ucnt = '-'
                        targetData.product_click_ucnt = '-'
                        targetData.product_pay_ucnt = '-'
                        targetData.product_show_click_ucnt_ratio = '-'
                        targetData.product_click_pay_ucnt_ratio = '-'
                    }
                }

                this.checkDataAndAddSubmitBtn()
            })
            this.listeners.push(listenerId1)

            const listenerId2 = this.requestManager.addListener('shop_ratio_list', /https:\/\/compass\.jinritemai\.com\/compass_api\/shop\/mall\/market\/shop_ratio_list?.*/, (url, data) => {
                let contentType = Utils.getQueryParam(url, 'content_type')
                let targetData = this.targetDataArr.find(data => data.content_type === contentType);
                targetData.category_ratio = []

                if (Utils.getQueryParam(url, 'module') === '2') {
                    let cardData = JSON.parse(data)['data']['module_data']['ratio_list']['compass_general_table_value']['data'];
                    if (cardData && cardData.length !== 1) {
                        cardData.forEach(category => {
                            let contentName = category['cell_info']['content_name']['value']['value_str'];
                            let curData = this.targetDataArr.find(rowData => rowData.channel_name === contentName);
                            if (curData) {
                                let extraValue = category['cell_info']['ratio']['index_values']['extra_value']
                                let lower = extraValue['lower']
                                let upper = extraValue['upper']
                                if (lower && upper) {
                                    curData.channel_ratio = `${Utils.covertToBaiFenString(lower['value'])}-${Utils.covertToBaiFenString(upper['value'])}`
                                } else {
                                    curData.channel_ratio = `未知`
                                }
                            }
                        })
                    }
                }

                if (Utils.getQueryParam(url, 'module') === '0') {
                    let cardData = JSON.parse(data)['data']['module_data']['ratio_list']['compass_general_table_value']['data'];
                    if (cardData) {
                        cardData.forEach(category => {
                            let item = {
                                "cateName": category['cell_info']['cate_name']['value']['value_str'],
                                "cateRatio": `未知`
                            }
                            let lower = category['cell_info']['ratio']['index_values']['extra_value']['lower'];
                            let upper = category['cell_info']['ratio']['index_values']['extra_value']['upper'];
                            if (lower && upper) {
                                item.cateRatio = `${Utils.covertToBaiFenString(lower['value'])}-${Utils.covertToBaiFenString(upper['value'])}`
                            }
                            targetData.category_ratio.push(item)
                        })
                    }
                }

                this.checkDataAndAddSubmitBtn()
            })
            this.listeners.push(listenerId2)
        }

        getFeiShuToken() {
            return Utils.sendHttpRequest('POST', 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal/', {}, {
                app_id: CONFIG.FEISHU_APP_ID,
                app_secret: CONFIG.FEISHU_APP_SECRET
            })
                .then(res => {
                    const result = JSON.parse(res);
                    if (result.tenant_access_token) {
                        return result.tenant_access_token;
                    } else {
                        throw new Error('获取飞书token失败');
                    }
                });
        }

        getSheetInfo(accessToken, sheetToken) {
            return Utils.sendHttpRequest('GET', `https://open.feishu.cn/open-apis/sheets/v3/spreadsheets/${sheetToken}/sheets/query`, {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }, null)
                .then(res => {
                    const result = JSON.parse(res);
                    if (result.data) {
                        return result.data;
                    } else {
                        throw new Error('获取飞书文档信息失败');
                    }
                });
        }

        updateDataToFeiShuOnlineExcel(accessToken, data, sheetToken) {
            console.log(data)
            return Utils.sendHttpRequest('PUT', `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${sheetToken}/values`, {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }, data)
                .then(res => {
                    if (res)
                        UI.showMessage('success', '数据写入成功')
                });
        }

        writeDataToFeiShuOnlineExcel() {
            this.getFeiShuToken()
                .then(accessToken => this.getSheetInfo(accessToken, this.sheetToken))
                .then(sheetInfo => {
                    let sheet = sheetInfo.sheets.find(sheet => sheet.title.endsWith(`-${this.shopId}`))
                    if (sheet) {
                        let sheetId = sheet.sheet_id
                        let range = `${sheetId}!A3:M22`
                        //排序
                        this.targetDataArr.sort((a, b) => {
                            if (a.channel_ratio === '未知' || b.channel_ratio === '未知') return Utils.convertToWanNumber(b.pay_amt) - Utils.convertToWanNumber(a.pay_amt);
                            return Utils.getRangeAvg(b.channel_ratio) - Utils.getRangeAvg(a.channel_ratio)
                        });
                        let values = []
                        this.targetDataArr.forEach(channelData => {
                            if (channelData.category_ratio.length === 0) {
                                values.push([channelData.channel_name, channelData.channel_ratio, channelData.pay_amt, channelData.own_ratio, channelData.pay_cnt, channelData.pay_per_usr_price,
                                channelData.product_show_ucnt, channelData.product_click_ucnt, channelData.product_pay_ucnt, channelData.product_show_click_ucnt_ratio, channelData.product_click_pay_ucnt_ratio,
                                    '', ''])
                            } else {
                                values.push([channelData.channel_name, channelData.channel_ratio, channelData.pay_amt, channelData.own_ratio, channelData.pay_cnt, channelData.pay_per_usr_price,
                                channelData.product_show_ucnt, channelData.product_click_ucnt, channelData.product_pay_ucnt, channelData.product_show_click_ucnt_ratio, channelData.product_click_pay_ucnt_ratio,
                                channelData.category_ratio[0].cateName, channelData.category_ratio[0].cateRatio])
                            }
                            for (let i = 1; i < 4; i++) {
                                if (channelData.category_ratio[i]) {
                                    values.push(['', '', '', '', '', '', '', '', '', '', '', channelData.category_ratio[i].cateName, channelData.category_ratio[i].cateRatio])
                                } else {
                                    values.push(['', '', '', '', '', '', '', '', '', '', '', '', ''])
                                }
                            }
                        })
                        let postData = {
                            "valueRange": {
                                "range": range,
                                "values": values,
                            }
                        }
                        return this.updateDataToFeiShuOnlineExcel(accessToken, postData, this.sheetToken)
                    }
                })
                .catch(error => {
                    UI.showMessage('error', error.message)
                })
        }

        destroy() {
            this.listeners.forEach(id => this.requestManager.removeListener(id))
            this.listeners = []
        }
    }

    // 商品数据抓取
    class ProductDataModule extends ModuleBase {
        static moduleId = 'productData'
        static moduleConfig = {
            name: '商品数据抓取',
            description: '抓取商品数据到飞书文档',
            configFields: [
                { key: 'feishuDocId', label: '飞书文档ID', placeholder: '请输入飞书文档ID' }
            ]
        }

        constructor(requestManager = RequestManager) {
            super()
            this.sheetToken = this.getConfig("feishuDocId")
            this.requestManager = requestManager
            this.productList = []
            this.date = ''
            this.listeners = []
        }

        init() {
            const listenerId = this.requestManager.addListener('product_list', /https:\/\/compass\.jinritemai\.com\/compass_api\/shop\/product\/product\/product_list\?.*/, (url, data) => {
                if (Utils.getQueryParam(url, 'cate_ids_original') === '0') {
                    this.date = Utils.getQueryParam(url, 'begin_date').split(" ")[0];
                    this.addSubmitBtn()
                }
                this.productList = JSON.parse(data)['data']
            })
            this.listeners.push(listenerId)
        }

        addSubmitBtn() {
            Utils.waitForElementByXPath("//tbody[@class='ecom-table-tbody']", 5000).then(tableBody => {
                setTimeout(() => {
                    let trs = tableBody.querySelectorAll('tr')
                    for (let i = 0; i < trs.length; i++) {
                        let tr = trs[i]
                        if (tr.classList.contains('ecom-table-measure-row')) {
                            continue
                        }
                        let tds = tr.querySelectorAll('td')
                        let productId = tds[1].querySelector('div[class^="productId-"]').innerHTML.match(/ID\s+(\d+)/)?.[1]
                        if (productId) {
                            let operateTd = tds[tds.length - 1];
                            const firstButton = operateTd.querySelector('td .ecom-btn');
                            const submitBtn = operateTd.querySelector('td .cus-submit-btn');

                            const newButton = document.createElement('button');
                            newButton.type = 'button';
                            newButton.className = 'ecom-btn ecom-btn-link cus-submit-btn';
                            newButton.textContent = '采集数据';
                            newButton.addEventListener('click', () => {
                                this.submitData(productId)
                            })
                            if (!submitBtn) {
                                firstButton.after(newButton);
                            } else {
                                submitBtn.parentNode.replaceChild(newButton, submitBtn);
                            }
                        }
                    }
                }, 900)
            })
        }

        submitData(productId) {
            let productData = this.productList.find(product => product['cell_info']['product_info']['product_id_value']['value']['value_str'] === productId);
            console.log(productData)
            let cellInfo = productData['cell_info']
            let payAmt = (cellInfo['pay_amt']['pay_amt_index_values']['index_values']['value']['value'] / 100).toFixed(2)
            let productShowUcnt = cellInfo['product_show_ucnt']['product_show_ucnt_index_values']['index_values']['value']['value']
            let productClickUcnt = cellInfo['product_click_ucnt']['product_click_ucnt_index_values']['index_values']['value']['value']
            let payUcnt = cellInfo['pay_ucnt']['pay_ucnt_index_values']['index_values']['value']['value']
            let productAddToCartUcnt = cellInfo['click_add_to_cart_uv']['click_add_to_cart_uv_index_values']['index_values']['value']['value']
            let productShowClickUcntRate = Utils.covertToBaiFenString(cellInfo['product_show_click_converse_uv_rate']['product_show_click_converse_uv_rate_index_values']['index_values']['value']['value'])
            let payRate = Utils.covertToBaiFenString(cellInfo['product_click_pay_converse_uv_rate']['product_click_pay_converse_uv_rate_index_values']['index_values']['value']['value'])
            let addCartRatio = Utils.covertToBaiFenString(cellInfo['product_add_show_converse_uv_ratio']['product_add_show_converse_uv_ratio_index_values']['index_values']['value']['value'])

            let values = [
                [this.date, payAmt, productShowUcnt, productClickUcnt, payUcnt, productAddToCartUcnt, productShowClickUcntRate, payRate, addCartRatio]
            ]

            this.getFeiShuToken()
                .then(accessToken => this.getSheetInfo(accessToken, this.sheetToken))
                .then(sheetInfo => {
                    let sheet = sheetInfo.sheets.find(sheet => sheet.title.endsWith(`-${productId}`))
                    if (sheet) {
                        let sheetId = sheet.sheet_id
                        let range = `${sheetId}!B2:J999`
                        let postData = {
                            "valueRange": {
                                "range": range,
                                "values": values,
                            }
                        }
                        return this.appendDataToFeiShuOnlineExcel(accessToken, postData, this.sheetToken)
                    } else {
                        UI.showMessage('error', `未找到【${productId}】对应表格`)
                    }
                })
                .catch(error => {
                    UI.showMessage('error', error.message)
                })
        }

        getFeiShuToken() {
            return Utils.sendHttpRequest('POST', 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal/', {}, {
                app_id: CONFIG.FEISHU_APP_ID,
                app_secret: CONFIG.FEISHU_APP_SECRET
            })
                .then(res => {
                    const result = JSON.parse(res);
                    if (result.tenant_access_token) {
                        return result.tenant_access_token
                    } else {
                        throw new Error('获取飞书token失败')
                    }
                })
        }

        getSheetInfo(accessToken, sheetToken) {
            return Utils.sendHttpRequest('GET', `https://open.feishu.cn/open-apis/sheets/v3/spreadsheets/${sheetToken}/sheets/query`, {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }, null)
                .then(res => {
                    const result = JSON.parse(res);
                    if (result.data) {
                        return result.data
                    } else {
                        throw new Error('获取飞书文档信息失败')
                    }
                })
        }

        appendDataToFeiShuOnlineExcel(accessToken, data, sheetToken) {
            console.log(data)
            return Utils.sendHttpRequest('POST', `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${sheetToken}/values_append`, {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }, data)
                .then(res => {
                    if (res)
                        UI.showMessage('success', '数据写入成功')
                })
        }

        destroy() {
            this.listeners.forEach(id => this.requestManager.removeListener(id))
            this.listeners = []
        }
    }

    // 商品卡榜单增强
    class ProductCardRankModule extends ModuleBase {

        static moduleId = 'productCardRankModule'
        static moduleConfig = {
            name: '商品卡榜单',
            description: '商品卡榜单数据分析'
        }

        constructor(requestManager) {
            super()
            this.requestManager = requestManager
            this.rankList = []
            this.listeners = []
        }
        init() {
            const listenerId = this.requestManager.addListener('product_card_hot', /https:\/\/compass\.jinritemai\.com\/compass_api\/shop\/mall\/product_rank\/product_card_hot_v2\?.*/, (url, data) => {
                this.rankList = JSON.parse(data).data.card_list
                console.log(this.rankList)
                this.addViewDetailButton()
            })
            this.listeners.push(listenerId)
        }

        addViewDetailButton() {
            Utils.waitForElementByXPath("//tbody[@class='ecom-table-tbody']", 5000).then(tableBody => {
                setTimeout(() => {
                    let thead = document.querySelector('thead.ecom-table-thead')
                    let theadTr = thead.querySelector('tr')
                    let ths = theadTr.querySelectorAll('th');
                    let operateTh = ths[ths.length - 1];
                    operateTh.classList.add('ecom-table-cell-fix-right')
                    operateTh.style.textAlign = 'center'
                    operateTh.style.position = 'sticky'
                    operateTh.style.right = '0'
                    operateTh.innerText = '操作'
                    //遍历tr
                    let trs = tableBody.querySelectorAll('tr')
                    for (let i = 0; i < trs.length; i++) {
                        let tr = trs[i]
                        if (tr.classList.contains('ecom-table-measure-row')) {
                            continue
                        }
                        let curRowData = this.rankList[i - 1];
                        let shopId = curRowData['shop_info']['shop_id']
                        let productId = curRowData['product_info']['id']
                        let tds = tr.querySelectorAll('td')
                        //添加1列操作栏
                        let operateTd = tds[tds.length - 1]
                        operateTd.classList.add('ecom-table-cell-fix-left')
                        operateTd.style.textAlign = 'center'
                        operateTd.style.position = 'sticky'
                        operateTd.style.right = '0'
                        operateTd.style.background = '#eeeff0'
                        operateTd.innerHTML = `<a href="https://compass.jinritemai.com/shop/chance/rank-product/detail?product_id=${productId}&product_shop_id=${shopId}&date_type=21&content_type=3" target="_blank">查看详情</a>`
                    }
                }, 900)
            })
        }

        destroy() {
            this.listeners.forEach(id => this.requestManager.removeListener(id))
            this.listeners = []
        }
    }

    // 店铺榜单数据采集
    class ShopRankModule extends ModuleBase {
        static moduleId = 'shopRankModule'
        static moduleConfig = {
            name: '罗盘竞店榜单',
            description: '一键显示关注店铺排名，意见更新在线表格',
            configFields: [
                { key: 'followShopNames', label: '关注店铺名称', placeholder: '多个店铺用逗号分隔' },
                { key: 'feishuDocId', label: '飞书文档ID', placeholder: '请输入飞书文档ID' },
                { key: 'feishuSheetId', label: '飞书工作表ID', placeholder: '请输入飞书工作表ID' }
            ]
        }

        constructor(requestManager) {
            super()
            this.requestManager = requestManager
            this.isCollecting = false;
            this.listenerId = 'shop_rank_collector';
            this.rankMap = new Map();
            this.followShopNames = new Set();
            this.listeners = [];
            this.floatingButton = null;
        }

        init() {
            // 更新商品卡榜单模块的关注店铺配置
            const followShopNames = this.getConfig('followShopNames')
            if (!followShopNames || followShopNames.trim() === '') {
                UI.showMessage('error', '请先配置关注店铺名称')
                return
            }
            if (followShopNames) {
                this.followShopNames = new Set(followShopNames.split(',').map(s => s.trim()).filter(s => s))
            }
            //等待ecom-spin-container元素出现
            Utils.waitForElementByXPath('//div[@class="ecom-spin-container"]', 5000).then(spinContainer => {
                this.floatingButton = UI.addFloatingButton({
                    text: '采集关注店铺',
                    style: {},
                    onClick: () => {
                        this.floatingButton.disabled = true;
                        this.startCollecting()
                        this.floatingButton.innerText = '数据采集中...'
                        // 按钮颜色变成不可点击的颜色
                        this.floatingButton.style.backgroundColor = '#cccccc';
                    }
                });
            })
        }

        destroy() {
            this.listeners.forEach(id => this.requestManager.removeListener(id))
            this.listeners = []
            if (this.floatingButton) {
                this.floatingButton.remove()
                this.floatingButton = null;
            }
        }

        startCollecting() {
            if (this.isCollecting) {
                UI.showMessage('error', '正在采集中，请勿重复点击');
                return;
            }
            this.isCollecting = true;

            // 更新商品卡榜单模块的关注店铺配置
            const followShopNames = this.getConfig('followShopNames')
            if (followShopNames) {
                this.followShopNames = new Set(followShopNames.split(',').map(s => s.trim()).filter(s => s))
            }
            console.log('[ShopRank] 关注店铺:', this.followShopNames);
            this.rankMap.clear();
            UI.showMessage('success', '开始采集数据...');

            const listenerId = this.requestManager.addListener(this.listenerId, /https:\/\/compass\.jinritemai\.com\/compass_api\/shop\/mall\/market\/shop_rank\?.*/, (url, data) => {
                this.handleRequest(url, data);
            });
            this.listeners.push(listenerId);
            this.clickFirstPage();
            setTimeout(() => {
                this.clickNextPage();
            }, 1000);
        }

        handleRequest(url, data) {
            try {
                const pageNo = parseInt(Utils.getQueryParam(url, 'page_no')) || 1;
                console.log(`[ShopRank] 收到第 ${pageNo} 页数据`);

                const jsonData = JSON.parse(data);
                const list = jsonData?.data?.module_data?.search_shop_rank?.compass_general_table_value?.data || [];
                list.forEach(item => {
                    const shopName = item?.cell_info?.shop?.shop?.shop_name;
                    const rankVal = Number(item?.cell_info?.rank?.index_values?.value?.value);
                    if (!shopName || Number.isNaN(rankVal)) return;
                    if (this.followShopNames.size && !this.followShopNames.has(shopName)) return;
                    const prev = this.rankMap.get(shopName);
                    if (prev === undefined || rankVal < prev) {
                        this.rankMap.set(shopName, rankVal);
                    }
                });
                console.log('[ShopRank] 目标店铺排名缓存:', this.rankMap);

                setTimeout(() => {
                    if (pageNo === 10) {
                        this.clickFirstPage();
                        setTimeout(() => {
                            this.stopCollecting();
                        }, 1000);
                    } else {
                        this.clickNextPage();
                    }
                }, 500);
            } catch (e) {
                console.error('[ShopRank] 处理请求失败:', e);
                UI.showMessage('error', '处理数据失败');
            }
        }

        clickNextPage() {
            const nextBtn = document.querySelector('li.ecom-pagination-next');
            if (nextBtn && !nextBtn.classList.contains('ecom-pagination-disabled')) {
                nextBtn.click();
                console.log('[ShopRank] 点击下一页');
            } else {
                console.warn('[ShopRank] 未找到下一页按钮或已禁用');
                this.stopCollecting();
            }
        }

        clickFirstPage() {
            const firstPageBtn = document.querySelector('li.ecom-pagination-item.ecom-pagination-item-1');
            if (firstPageBtn) {
                firstPageBtn.click();
                console.log('[ShopRank] 点击第一页');
            } else {
                console.warn('[ShopRank] 未找到第一页按钮');
            }
        }

        stopCollecting() {
            if (!this.isCollecting) return;

            this.isCollecting = false;
            this.listeners.forEach(id => this.requestManager.removeListener(id));
            this.listeners = [];
            UI.showMessage('success', '数据采集完成！');
            if (this.floatingButton) {
                this.floatingButton.disabled = false;
                this.floatingButton.innerText = '采集关注店铺';
                // 按钮颜色恢复正常
                this.floatingButton.style.backgroundColor = '#4285f4';
            }
            console.log('[ShopRank] 采集结束');

            const results = [];
            this.followShopNames.forEach(name => {
                const rank = this.rankMap.get(name);
                const numericRank = rank === undefined ? Infinity : Number(rank);
                results.push({
                    name,
                    rank: numericRank,
                    rankText: numericRank === Infinity ? '200+' : `第 ${numericRank} 名`
                });
            });

            results.sort((a, b) => a.rank - b.rank);
            this.floatingButton.style.display = 'none'
            this.showRankResultModal('目标店铺榜单概览', results);
            this.rankMap.clear();
        }
        /**
         * 显示排名结果模态框
         */
        showRankResultModal(title, results = []) {
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.45)';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.overflowY = 'scroll';
            overlay.style.zIndex = '999';

            const container = document.createElement('div')
            container.style.top = '160px';
            container.style.minWidth = '360px'
            container.style.maxWidth = '520px'
            container.style.backgroundColor = '#fff'
            container.style.borderRadius = '12px'
            container.style.boxShadow = '0 16px 40px rgba(15, 23, 42, 0.25)'
            container.style.padding = '24px 28px 28px'
            container.style.fontFamily = '"Segoe UI", PingFangSC, "Microsoft YaHei", sans-serif'
            container.style.color = '#0f172a'
            container.style.position = 'relative'

            const closeBtn = document.createElement('span')
            closeBtn.innerText = '×'
            closeBtn.style.position = 'absolute'
            closeBtn.style.right = '18px'
            closeBtn.style.top = '12px'
            closeBtn.style.fontSize = '22px'
            closeBtn.style.cursor = 'pointer'
            closeBtn.style.color = '#94a3b8'
            closeBtn.addEventListener('mouseenter', () => closeBtn.style.color = '#0f172a')
            closeBtn.addEventListener('mouseleave', () => closeBtn.style.color = '#94a3b8')
            closeBtn.addEventListener('click', () => overlay.remove())

            const titleEl = document.createElement('h3')
            titleEl.innerText = title
            titleEl.style.margin = '0'
            titleEl.style.marginBottom = '16px'
            titleEl.style.fontSize = '20px'
            titleEl.style.fontWeight = '600'

            const subtitle = document.createElement('p')
            subtitle.innerText = '以下为目标店铺的实时排名（按名次从高到低排序）'
            subtitle.style.margin = '0 0 20px'
            subtitle.style.fontSize = '14px'
            subtitle.style.color = '#64748b'

            const table = document.createElement('div')
            table.style.border = '1px solid #e2e8f0'
            table.style.borderRadius = '10px'
            table.style.overflow = 'hidden'

            const header = document.createElement('div')
            header.style.display = 'grid'
            header.style.gridTemplateColumns = '1fr 1fr'
            header.style.backgroundColor = '#f8fafc'
            header.style.fontSize = '13px'
            header.style.fontWeight = '600'
            header.style.color = '#475569'

            const headerName = document.createElement('div')
            headerName.innerText = '店铺名称'
            headerName.style.padding = '12px 16px'

            const headerRank = document.createElement('div')
            headerRank.innerText = '当前排名'
            headerRank.style.padding = '12px 16px'
            headerRank.style.textAlign = 'right'

            header.appendChild(headerName)
            header.appendChild(headerRank)
            table.appendChild(header)

            if (results.length === 0) {
                const empty = document.createElement('div')
                empty.innerText = '未检索到目标店铺数据'
                empty.style.padding = '20px 16px'
                empty.style.textAlign = 'center'
                empty.style.fontSize = '14px'
                empty.style.color = '#94a3b8'
                table.appendChild(empty)
            } else {
                results.forEach((item, idx) => {
                    const row = document.createElement('div')
                    row.style.display = 'grid'
                    row.style.gridTemplateColumns = '1fr 1fr'
                    row.style.alignItems = 'center'
                    row.style.backgroundColor = idx % 2 === 0 ? '#ffffff' : '#f9fbff'

                    const nameCell = document.createElement('div')
                    nameCell.innerText = item.name
                    nameCell.style.padding = '12px 16px'
                    nameCell.style.fontSize = '14px'
                    nameCell.style.color = '#1e293b'

                    const rankCell = document.createElement('div')
                    rankCell.style.padding = '12px 16px'
                    rankCell.style.fontSize = '16px'
                    rankCell.style.fontWeight = '600'
                    rankCell.style.textAlign = 'right'
                    rankCell.innerText = item.rankText
                    rankCell.style.color = item.rank === Infinity ? '#f97316' : (item.rank <= 10 ? '#0ea5e9' : '#0f172a')

                    row.appendChild(nameCell)
                    row.appendChild(rankCell)
                    table.appendChild(row)
                })
            }

            const footer = document.createElement('div')
            footer.style.marginTop = '24px'
            footer.style.textAlign = 'right'

            const confirmBtn = document.createElement('button')
            confirmBtn.innerText = '我知道了'
            confirmBtn.style.padding = '10px 20px'
            confirmBtn.style.background = 'linear-gradient(135deg, #0ea5e9, #3b82f6)'
            confirmBtn.style.border = 'none'
            confirmBtn.style.borderRadius = '6px'
            confirmBtn.style.color = '#fff'
            confirmBtn.style.fontSize = '14px'
            confirmBtn.style.cursor = 'pointer'
            confirmBtn.style.boxShadow = '0 10px 20px rgba(59, 130, 246, 0.25)'
            confirmBtn.addEventListener('mouseenter', () => confirmBtn.style.opacity = '0.9')
            confirmBtn.addEventListener('mouseleave', () => confirmBtn.style.opacity = '1')
            confirmBtn.addEventListener('click', () => {
                overlay.remove()
                this.floatingButton.style.display = 'block'
            })

            const syncOnlineExcelBtn = document.createElement('button')
            syncOnlineExcelBtn.innerText = '更新在线表格'
            syncOnlineExcelBtn.style.padding = '10px 20px'
            syncOnlineExcelBtn.style.marginRight = '10px'
            syncOnlineExcelBtn.style.background = 'linear-gradient(135deg, rgb(75 203 86), rgb(32 187 66))'
            syncOnlineExcelBtn.style.border = 'none'
            syncOnlineExcelBtn.style.borderRadius = '6px'
            syncOnlineExcelBtn.style.color = '#fff'
            syncOnlineExcelBtn.style.fontSize = '14px'
            syncOnlineExcelBtn.style.cursor = 'pointer'
            syncOnlineExcelBtn.style.boxShadow = '0 10px 20px rgba(91, 245, 104, 0.25)'
            syncOnlineExcelBtn.addEventListener('mouseenter', () => syncOnlineExcelBtn.style.opacity = '0.9')
            syncOnlineExcelBtn.addEventListener('mouseleave', () => syncOnlineExcelBtn.style.opacity = '1')
            syncOnlineExcelBtn.addEventListener('click', () => this.syncOnlineExcel(results, syncOnlineExcelBtn))

            footer.appendChild(syncOnlineExcelBtn)
            footer.appendChild(confirmBtn)

            container.appendChild(closeBtn)
            container.appendChild(titleEl)
            container.appendChild(subtitle)
            container.appendChild(table)
            container.appendChild(footer)

            overlay.appendChild(container)
            document.body.appendChild(overlay)
        }

        async syncOnlineExcel(shopRankData, syncOnlineExcelBtn) {
            try {
                syncOnlineExcelBtn.disabled = true
                syncOnlineExcelBtn.innerText = '更新中...'

                FeishuAPI.checkInitialized()
                const feishuDocId = this.getConfig('feishuDocId')
                const feishuSheetId = this.getConfig('feishuSheetId')
                if (!feishuDocId || feishuDocId.trim() === '' || !feishuSheetId || feishuSheetId.trim() === '') {
                    throw new Error('请先配置飞书文档ID和工作表ID')
                }

                // 1. 读取第一行(表头)数据,确定日期列
                console.log('正在读取表头数据...');
                const headerRange = `${feishuSheetId}!A1:ZZ1`; // 读取第一行,假设不超过ZZ列
                const headerData = await FeishuAPI.readRange(feishuDocId, headerRange, {
                    dateTimeRenderOption: 'FormattedString'
                });
                if (!headerData || headerData.length === 0) {
                    throw new Error('读取表头数据失败')
                }

                const headerRow = headerData[0];
                const currentDate = Utils.getCurrentDate();
                console.log(`当前日期: ${currentDate}`);

                // 查找匹配的日期列
                let targetColumnIndex = -1;
                console.log('开始匹配日期列...');
                for (let i = 1; i < headerRow.length; i++) { // 从第2列开始(跳过第1列的"登记日期"标题)
                    const cellDate = headerRow[i];
                    if (cellDate === currentDate) {
                        targetColumnIndex = i;
                        console.log(`  ✓ 找到匹配!`);
                        break;
                    }
                }

                if (targetColumnIndex === -1) {
                    throw new Error(`未找到日期为 ${currentDate} 的列,请先在表头添加该日期列`);
                }

                const targetColumn = FeishuAPI.columnIndexToLetter(targetColumnIndex);
                console.log(`找到目标列: ${targetColumn} (索引: ${targetColumnIndex})`);

                // 2. 读取第一列(店铺名称列)
                const shopNameRange = `${feishuSheetId}!A2:A100`; // 从第2行开始读取,假设不超过1000行
                const shopNameData = await FeishuAPI.readRange(feishuDocId, shopNameRange);
                if (!shopNameData || shopNameData.length === 0) {
                    throw new Error('读取店铺名称列失败')
                }

                // 结果数据转成map
                const shopRankMap = {};
                shopRankData.forEach(item => {
                    shopRankMap[item.name] = item.rank !== Infinity ? Number(item.rank) : '200+';
                });

                // 3. 构造写入数据
                const writeData = []
                for (const row of shopNameData) {
                    if (row && row[0]) {
                        const shopName = String(row[0]).trim();
                        const rankValue = shopRankMap[shopName] || '200+';
                        writeData.push([rankValue])
                    } else {
                        break
                    }
                }

                // 4. 写入数据
                const cellRange = `${feishuSheetId}!${targetColumn}2:${targetColumn}${writeData.length + 1}`;
                await FeishuAPI.writeRange(feishuDocId, cellRange, writeData);
                syncOnlineExcelBtn.disabled = false
                syncOnlineExcelBtn.innerText = '更新在线表格'
                UI.showMessage('success', '更新数据成功')
            } catch (error) {
                syncOnlineExcelBtn.disabled = false
                syncOnlineExcelBtn.innerText = '更新在线表格'
                console.error(`写入数据时出错: }`, error)
                UI.showMessage('error', `写入数据时出错: ${error.message}`)
            }
        }
    }

    // 千川素材分析页监听
    class QianchuanMaterialModule extends ModuleBase {
        static moduleId = 'qianchuanMaterial'
        static moduleConfig = {
            name: '千川素材分析',
            description: '千川广告素材分析功能'
        }

        constructor(requestManager = RequestManager) {
            super()
            this.requestManager = requestManager
            this.listeners = []
        }
        init() {
            const listenerId = this.requestManager.addListener('qianchuan_statQuery', /ad\/api\/data\/v1\/common\/statQuery\?.*/, (url, data) => {
                try {
                    const json = JSON.parse(data)
                    const items = json.data.StatsData.Rows
                    let total_cost = 0
                    for (let i = 0; i < items.length; i++) {
                        let item = items[i]
                        total_cost += item.Metrics.stat_cost_for_roi2.Value
                    }
                    UI.showMessage('success', `素材分析数据已捕获：${items.length} 条，总消耗：${total_cost} 元`)
                } catch (e) {
                    console.error('[QC statQuery] parse error', e)
                    UI.showMessage('error', '素材分析数据解析失败')
                }
            })
            this.listeners.push(listenerId)
        }

        destroy() {
            this.listeners.forEach(id => this.requestManager.removeListener(id))
            this.listeners = []
        }
    }

    /* =========================功能模块 END=========================== */

    // ========== 主应用类 ==========
    class DouDianToolBox {

        constructor() {
            this.requestListenerManager = new RequestListenerManager()
            this.moduleManager = ModuleRegistryManager.getInstance()
            this.configManager = ConfigManager.getInstance()
            this.isInitialized = false
            this.init()
        }

        async init() {
            if (this.isInitialized) return
            this.isInitialized = true

            console.log('抖店工具箱初始化开始...')
            // 初始化配置管理器
            await this.configManager.init()
            // 初始化飞书API
            FeishuAPI.init({
                appId: this.configManager.getGlobalConfig('feishuAppId'),
                appSecret: this.configManager.getGlobalConfig('feishuAppSecret')
            })
            if (this.configManager.getGlobalConfig('dingtalkAppKey')
                && this.configManager.getGlobalConfig('dingtalkAppSecret')
                && this.configManager.getGlobalConfig('dingtalkOperatorId')) {
                DingTalkSDK.init(
                    this.configManager.getGlobalConfig('dingtalkAppKey'),
                    this.configManager.getGlobalConfig('dingtalkAppSecret'),
                    this.configManager.getGlobalConfig('dingtalkOperatorId')
                )
            }
            // 初始化路由管理器
            this.setupRoutes()
            this.moduleManager.start()

            console.log('抖店工具箱初始化完成！')
        }

        getRequestListenerManager() {
            return this.requestListenerManager
        }

        getModuleRegistryManager() {
            return this.moduleManager
        }

        setupRoutes() {
            // 商品列表页面模块
            this.moduleManager.registerModule(
                ProductListModule.moduleId,
                /fxg\.jinritemai\.com\/ffa\/g\/list/,
                () => {
                    console.log('初始化商品列表模块')
                    const module = new ProductListModule(this.requestListenerManager)
                    module.init()
                    return module
                },
                (module) => {
                    console.log('清理商品列表模块')
                    if (module && module.destroy) {
                        module.destroy()
                    }
                },
                {
                    priority: 0,
                    enabled: this.configManager.getModuleEnabled(ProductListModule.moduleId),
                    moduleConfig: ProductListModule.moduleConfig,
                }
            )
            //商品库存快速获取模块
            this.moduleManager.registerModule(
                LiveProductStockPreviewModule.moduleId,
                /fxg\.jinritemai\.com\/ffa\/content-tool\/live\/control/,
                () => {
                    console.log('初始化商品库存快速获取模块')
                    const module = new LiveProductStockPreviewModule(this.requestListenerManager)
                    module.init()
                    return module
                },
                (module) => {
                    console.log('清理商品库存快速获取模块')
                    if (module && module.destroy) {
                        module.destroy()
                    }
                },
                {
                    priority: 1,
                    enabled: this.configManager.getModuleEnabled(LiveProductStockPreviewModule.moduleId, false),
                    moduleConfig: LiveProductStockPreviewModule.moduleConfig,
                }
            )

            // 注册商品编辑增强模块
            this.moduleManager.registerModule(
                ProductEditModule.moduleId,
                /fxg\.jinritemai\.com\/ffa\/g\/create/,
                () => {
                    console.log('初始化商品编辑增强模块')
                    const module = new ProductEditModule()
                    module.init()
                    return module
                },
                (module) => {
                    console.log('清理商品编辑增强模块')
                    if (module && module.destroy) {
                        module.destroy()
                    }
                },
                {
                    priority: 0,
                    enabled: this.configManager.getModuleEnabled(ProductEditModule.moduleId),
                    moduleConfig: ProductEditModule.moduleConfig,
                }
            )

            // 直播商品页面模块
            this.moduleManager.registerModule(
                LiveModule.moduleId,
                /ffa\/content-tool\/live\/control/,
                () => {
                    console.log('初始化直播商品模块')
                    const module = new LiveModule(this.requestListenerManager)
                    module.init()
                    return module
                },
                (module) => {
                    console.log('清理直播商品模块')
                    if (module && module.destroy) {
                        module.destroy()
                    }
                },
                {
                    priority: 0,
                    enabled: this.configManager.getModuleEnabled(LiveModule.moduleId),
                    moduleConfig: LiveModule.moduleConfig,
                }
            )

            // 直播大屏数据登记模块
            this.moduleManager.registerModule(
                LiveScreenModule.moduleId,
                /\/screen\/live\/shop/,
                () => {
                    console.log('初始化直播大屏数据登记模块')
                    const module = new LiveScreenModule(this.requestListenerManager)
                    module.init()
                    return module
                },
                (module) => {
                    if (module && module.destroy) {
                        module.destroy()
                    }
                },
                {
                    priority: 0,
                    enabled: this.configManager.getModuleEnabled(LiveScreenModule.moduleId),
                    moduleConfig: LiveScreenModule.moduleConfig,
                }
            )

            // 罗盘竞店数据页面模块
            this.moduleManager.registerModule(
                CompetingStoreDataModule.moduleId,
                /compass\.jinritemai\.com\/shop\/chance\/rank-shop\/detail/,
                () => {
                    console.log('初始化罗盘竞店数据模块')
                    const module = new CompetingStoreDataModule(this.requestListenerManager)
                    module.init()
                    return module
                },
                (module) => {
                    console.log('清理罗盘竞店数据模块')
                    if (module && module.destroy) {
                        module.destroy()
                    }
                },
                {
                    priority: 0,
                    enabled: this.configManager.getModuleEnabled(CompetingStoreDataModule.moduleId),
                    moduleConfig: CompetingStoreDataModule.moduleConfig,
                }
            )

            // 罗盘竞店榜单页面模块
            this.moduleManager.registerModule(
                ShopRankModule.moduleId,
                /compass\.jinritemai\.com\/shop\/chance\/rank-shop\?/,
                () => {
                    console.log('初始化罗盘竞店榜单模块')
                    const module = new ShopRankModule(this.requestListenerManager)
                    module.init()
                    return module
                },
                (module) => {
                    console.log('清理罗盘竞店榜单模块')
                    if (module && module.destroy) {
                        module.destroy()
                    }
                },
                {
                    priority: 0,
                    enabled: this.configManager.getModuleEnabled(ShopRankModule.moduleId),
                    moduleConfig: ShopRankModule.moduleConfig,
                }
            )

            // 商品数据抓取页面模块
            // this.moduleManager.registerModule(
            //     ProductDataModule.moduleId,
            //     /compass\.jinritemai\.com\/shop\/commodity\/product-list/,
            //     () => {
            //         console.log('初始化商品数据抓取模块')
            //         const module = new ProductDataModule(this.requestListenerManager)
            //         module.init()
            //         return module
            //     },
            //     (module) => {
            //         console.log('清理商品数据抓取模块')
            //         if (module && module.destroy) {
            //             module.destroy()
            //         }
            //     },
            //     {
            //         priority: 0,
            //         enabled: this.configManager.getModuleEnabled(ProductDataModule.moduleId),
            //         moduleConfig: ProductDataModule.moduleConfig,
            //     }
            // )

            // 商品卡榜单页面模块
            this.moduleManager.registerModule(
                ProductCardRankModule.moduleId,
                /compass\.jinritemai\.com\/shop\/chance\/product-rank/,
                () => {
                    console.log('初始化商品卡榜单增强模块')
                    const module = new ProductCardRankModule(this.requestListenerManager)
                    module.init()
                    return module
                },
                (module) => {
                    console.log('清理商品卡榜单增强模块')
                    if (module && module.destroy) {
                        module.destroy()
                    }
                },
                {
                    priority: 0,
                    enabled: this.configManager.getModuleEnabled(ProductCardRankModule.moduleId),
                    moduleConfig: ProductCardRankModule.moduleConfig,
                }
            )

            // 千川素材分析页面模块
            // this.moduleManager.registerModule(
            //     QianchuanMaterialModule.moduleId,
            //     /qianchuan\.jinritemai\.com\/dataV2\/roi2-material-analysis/,
            //     () => {
            //         console.log('初始化千川素材分析监听模块')
            //         const module = new QianchuanMaterialModule(this.requestListenerManager)
            //         module.init()
            //         return module
            //     },
            //     (module) => {
            //         console.log('清理千川素材分析监听模块')
            //         if (module && module.destroy) {
            //             module.destroy()
            //         }
            //     },
            //     {
            //         priority: 0,
            //         enabled: this.configManager.getModuleEnabled(QianchuanMaterialModule.moduleId),
            //         moduleConfig: QianchuanMaterialModule.moduleConfig,
            //     }
            // )

            // 示例：为同一个URL注册多个模块（按优先级排序）
            // this.moduleManager.registerModule(
            //     'productListExtra',
            //     /fxg\.jinritemai\.com\/ffa\/g\/list/,
            //     () => {
            //         console.log('初始化商品列表额外模块')
            //         const module = new ProductListExtraEnhancement()
            //         module.init()
            //         return module
            //     },
            //     (module) => {
            //         console.log('清理商品列表额外模块')
            //         if (module && module.destroy) {
            //             module.destroy()
            //         }
            //     },
            //     200,  // 更高的优先级，会先加载
            //     () => this.configManager.getModuleEnabled('productListExtra')
            // )
        }
    }

    // ========== 聚水潭工具类 ==========
    class JuShuiTanTool {
        constructor() {
            this.configManager = ConfigManager.getInstance()
            this.baseURL = 'https://api.erp321.com'
            this.cookie = null
        }

        static getInstance(configManager) {
            if (!this.instance) {
                this.instance = new JuShuiTanTool(configManager)
            }
            return this.instance
        }

        /**
         * 自动登录获取Cookie
         * 从ConfigManager获取账号密码进行登录
         */
        async autoLogin() {
            try {
                // 从配置管理器获取聚水潭账号信息
                const account = this.configManager.getGlobalConfig('juShuiTanAccount')
                const password = this.configManager.getGlobalConfig('juShuiTanPassword')

                const loginData = {
                    data: {
                        account: account,
                        password: password,
                        isApp: false
                    }
                }

                console.log('开始聚水潭自动登录...')

                const response = await Utils.sendHttpRequest('POST',
                    `${this.baseURL}/erp/webapi/UserApi/WebLogin/Passport`,
                    {
                        'accept': 'application/json, text/plain, */*',
                        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0',
                        'Content-Type': 'application/json'
                    },
                    loginData
                )
                const result = JSON.parse(response)

                if (result.code === 0 && result.cookie) {
                    // 成功登录，提取cookie信息

                    // 将cookie对象转换为cookie字符串格式
                    const cookieString = Object.entries(result.cookie)
                        .map(([key, value]) => `${key}=${value}`)
                        .join('; ')
                    this.cookie = cookieString
                    this.configManager.setGlobalConfig('juShuiTanCookie', cookieString)
                    await this.configManager.saveConfig()
                    console.log('聚水潭登录成功，Cookie已保存')
                    console.log('用户信息:', {
                        mobile: result.data?.mobile,
                        company: decodeURIComponent(result.cookie.u_co_name || ''),
                        userName: decodeURIComponent(result.cookie.u_name || ''),
                        safeLevel: result.data?.safeLevel
                    })
                    UI.showMessage('success', '聚水潭登录成功！')
                    return {
                        success: true,
                        cookie: cookieString,
                        message: '登录成功'
                    }
                } else {
                    const errorMsg = result.msg || result.message || '登录失败'
                    console.error('聚水潭登录失败:', errorMsg)
                    UI.showMessage('error', `聚水潭登录失败: ${errorMsg}`)

                    return {
                        success: false,
                        message: errorMsg
                    }
                }
            } catch (error) {
                console.error('聚水潭登录异常:', error)
                UI.showMessage('error', `聚水潭登录异常: ${error.message}`)
                return {
                    success: false,
                    message: error.message
                }
            }
        }

        /**
         * 清除Cookie
         */
        clearCookie() {
            this.cookie = null
            this.configManager.setGlobalConfig('juShuiTanCookie', '')
            console.log('聚水潭Cookie已清除')
        }

        /**
         * 从cookie字符串中提取指定名称的值
         * @param {string} cookieString - cookie字符串
         * @param {string} name - 要提取的cookie名称
         * @returns {string|null} - cookie值，如果不存在则返回null
         */
        extractCookieValue(cookieString, name) {
            if (!cookieString) return null

            // 使用正则表达式匹配cookie值
            const regex = new RegExp(`(?:^|;)\\s*${name}=([^;]*)`)
            const match = cookieString.match(regex)

            return match ? match[1] : null
        }

        /**
         * 从cookie中提取u_id和u_co_id
         * @param {string} cookieString - cookie字符串
         * @returns {Object} - 包含u_id和u_co_id的对象
         */
        extractUserInfoFromCookie(cookieString) {
            const uId = this.extractCookieValue(cookieString, 'u_id')
            const uCoId = this.extractCookieValue(cookieString, 'u_co_id')

            return {
                uId: uId,
                uCoId: uCoId,
                hasUserInfo: !!(uId && uCoId)
            }
        }

        /**
         * 验证当前登录状态
         */
        async validateLoginStatus() {
            try {
                if (!this.cookie) {
                    this.cookie = this.configManager.getGlobalConfig('juShuiTanCookie')
                }

                if (!this.cookie) {
                    return { valid: false, message: '没有Cookie' }
                }
                const callBackParam = {
                    "Method": "LoadDataToJSON",
                    "Args": ["1", `[]`, "{}"]
                }
                const callBackParamStr = JSON.stringify(callBackParam)
                const params = `__VIEWSTATE=%2FwEPDwUKLTYxMzg5NTU3MWRkpa9oWac5nJUlZdTmtux9W%2F7UGS8%3D&__VIEWSTATEGENERATOR=491FF2E7&sku_id=&_jt_page_size=15&__CALLBACKID=JTable1&__CALLBACKPARAM=${encodeURIComponent(callBackParamStr)}`

                const res = await Utils.sendHttpRequest('POST', 'https://www.erp321.com/app/item/SkuStock/SkuStock.aspx?_c=jst-epaas&am___=LoadDataToJSON', {
                    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                    'Cookie': this.cookie
                }, params)
                const resJsonStr = res.substring(2)
                const resJson = JSON.parse(resJsonStr)
                // console.log('验证登录状态返回数据:', resJson)
                if (!resJson["IsSuccess"]) {
                    console.error('验证登录状态失败:', resJson)
                    return { valid: false, message: '验证登录状态失败' }
                }
                const gotoLogin = resJson['GotoLogin']

                // 根据返回的code判断登录状态
                if (!gotoLogin) {
                    return { valid: true, message: '登录状态正常' }
                } else {
                    console.log('Cookie已过期，需要重新登陆：', resJson)
                    return { valid: false, message: '登录已失效' }
                }
            } catch (error) {
                console.error('验证登录状态失败:', error)
                return { valid: false, message: '验证登录状态失败: ' + error.message }
            }
        }

        /**
         * 获取当前Cookie的详细信息
         * @returns {Object} - 包含cookie详细信息的对象
         */
        getCookieDetails() {
            const cookie = this.cookie || this.configManager.getGlobalConfig('juShuiTanCookie')
            if (!cookie) {
                return {
                    hasCookie: false,
                    message: '没有有效的Cookie'
                }
            }

            const userInfo = this.extractUserInfoFromCookie(cookie)

            return {
                hasCookie: true,
                cookiePreview: cookie.substring(0, 50) + (cookie.length > 50 ? '...' : ''),
                cookieLength: cookie.length,
                userInfo: userInfo,
                uId: userInfo.uId,
                uCoId: userInfo.uCoId,
                hasUserInfo: userInfo.hasUserInfo
            }
        }

        /**
         * 确保获取有效的Cookie，处理自动登录和Cookie验证
         * @returns {Promise<string>} - 返回有效的Cookie字符串
         * @throws {Error} - 当无法获取有效Cookie时抛出错误
         */
        async ensureValidCookie() {
            let erp321Cookie = this.cookie || this.configManager.getGlobalConfig('juShuiTanCookie')

            // 如果不存在Cookie，检查账号密码是否存在
            if (!erp321Cookie || erp321Cookie.trim() === "") {
                console.log('未找到Cookie，检查账号密码配置...')

                const account = this.configManager.getGlobalConfig('juShuiTanAccount')
                const password = this.configManager.getGlobalConfig('juShuiTanPassword')

                if (!account || !password) {
                    UI.showMessage('error', '请设置聚水潭账号和密码，或手动设置Cookie')
                    throw new Error('请设置聚水潭账号和密码，或手动设置Cookie')
                }

                console.log('发现账号密码配置，尝试自动登录...')

                // 尝试自动登录
                try {
                    const loginResult = await this.autoLogin()
                    if (!loginResult.success) {
                        UI.showMessage('error', `自动登录失败: ${loginResult.message}`)
                        throw new Error(`自动登录失败: ${loginResult.message}`)
                    }

                    // 登录成功后重新获取cookie
                    erp321Cookie = this.cookie || this.configManager.getGlobalConfig('juShuiTanCookie')
                    if (!erp321Cookie) {
                        UI.showMessage('error', '自动登录成功但未获取到Cookie')
                        throw new Error('自动登录成功但未获取到Cookie')
                    }

                    console.log('自动登录成功，获取到Cookie')
                } catch (loginError) {
                    UI.showMessage('error', `自动登录失败: ${loginError.message}`)
                    throw new Error(`自动登录失败: ${loginError.message}`)
                }
            } else {
                // Cookie存在，验证其有效性
                console.log('发现Cookie，验证其有效性...')
                try {
                    const validateResult = await this.validateLoginStatus()
                    if (!validateResult.valid) {
                        console.log('Cookie已过期或无效:', validateResult.message)

                        // Cookie无效，尝试重新登录
                        const account = this.configManager.getGlobalConfig('juShuiTanAccount')
                        const password = this.configManager.getGlobalConfig('juShuiTanPassword')

                        if (account && password) {
                            console.log('尝试重新登录...')
                            const loginResult = await this.autoLogin()
                            if (!loginResult.success) {
                                UI.showMessage('error', `重新登录失败: ${loginResult.message}`)
                                throw new Error(`重新登录失败: ${loginResult.message}`)
                            }

                            // 重新获取cookie
                            erp321Cookie = this.cookie || this.configManager.getGlobalConfig('juShuiTanCookie')
                            if (!erp321Cookie) {
                                UI.showMessage('error', '重新登录成功但未获取到Cookie')
                                throw new Error('重新登录成功但未获取到Cookie')
                            }

                            console.log('重新登录成功，Cookie已更新')
                        } else {
                            UI.showMessage('error', 'Cookie已过期，请设置账号密码或手动更新Cookie')
                            throw new Error('Cookie已过期，请设置账号密码或手动更新Cookie')
                        }
                    } else {
                        console.log('Cookie验证通过，用户状态正常')
                    }
                } catch (validateError) {
                    UI.showMessage('error', `Cookie验证失败: ${validateError.message}`)
                    console.error('验证Cookie时出错:', validateError)
                    throw new Error(`Cookie验证失败: ${validateError.message}`)
                }
            }
            return erp321Cookie
        }

        /**
         * 批量获取商品库存
         * @param {string[]} skuIds - SKU ID数组
         * @returns {Promise<Map>} - 返回SKU ID到库存数量的映射
         */
        async getProductInventory(skuIds) {
            console.log("批量获取商品库存：", skuIds)

            let erp321Cookie = await this.ensureValidCookie()

            const skuStockMap = new Map()

            if (!skuIds || skuIds.length === 0) {
                return skuStockMap
            }

            // 并发处理所有SKU查询
            const promises = skuIds.map(async (skuId) => {
                const callBackParam = {
                    "Method": "LoadDataToJSON",
                    "Args": ["1", `[{"k":"sku_id","v":"${skuId}","c":"like"}]`, "{}"]
                }
                const callBackParamStr = JSON.stringify(callBackParam)
                const params = `__VIEWSTATE=%2FwEPDwUKLTYxMzg5NTU3MWRkpa9oWac5nJUlZdTmtux9W%2F7UGS8%3D&__VIEWSTATEGENERATOR=491FF2E7&sku_id=${skuId}&_jt_page_size=500&__CALLBACKID=JTable1&__CALLBACKPARAM=${encodeURIComponent(callBackParamStr)}`

                try {
                    const res = await Utils.sendHttpRequest('POST', 'https://www.erp321.com/app/item/SkuStock/SkuStock.aspx?_c=jst-epaas&am___=LoadDataToJSON', {
                        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                        'Cookie': erp321Cookie
                    }, params)

                    try {
                        const resJsonStr = res.substring(2)
                        const resJson = JSON.parse(resJsonStr)

                        if (!resJson["IsSuccess"]) {
                            console.warn(`查询SKU ${skuId} 库存失败:`, resJson)
                            return
                        }
                        // console.log(`查询SKU ${skuId} 库存成功:`, resJson)
                        const dataJson = JSON.parse(resJson['ReturnValue'])
                        dataJson['datas'].forEach(skuData => {
                            // 计算可用库存：总库存 - 锁定库存 - 运营云仓库存 - 订单锁定 + 进货仓库存
                            const stockNum = skuData['qty'] - skuData['lock_qty'] - skuData['lwh_result_lock_qty'] - skuData['order_lock'] + skuData['in_qty']
                            // 计算预售库存：总库存 - 锁定库存 - 运营云仓库存 - 订单锁定 + 在途库存 + 采购在途库存
                            const preStockNum = skuData['qty'] - skuData['lock_qty'] - skuData['lwh_result_lock_qty'] - skuData['order_lock'] + skuData['in_qty'] + skuData['purchase_qty']
                            skuStockMap.set(skuData['sku_id'], stockNum)
                            skuStockMap.set(skuData['sku_id'] + '==', preStockNum)
                        })
                    } catch (parseError) {
                        console.error(`解析SKU ${skuId} 库存数据失败:`, parseError)
                    }
                } catch (err) {
                    console.error(`查询SKU ${skuId} 库存失败:`, err)
                }
            })

            // 等待所有查询完成
            await Promise.all(promises)

            // console.log("批量库存查询完成，结果:", skuStockMap)
            return skuStockMap
        }

        /**
         * 批量获取商品库存详情
         * @param {string[]} skuIds - SKU ID数组
         * @returns {Promise<Map>} - 返回SKU ID到库存数量的映射
         */
        async getProductInventoryDetail(skuIds) {
            console.log("批量获取商品库存详情：", skuIds)

            let erp321Cookie = await this.ensureValidCookie()

            const skuStockMap = new Map()

            if (!skuIds || skuIds.length === 0) {
                return skuStockMap
            }

            // 并发处理所有SKU查询
            const promises = skuIds.map(async (skuId) => {
                const callBackParam = {
                    "Method": "LoadDataToJSON",
                    "Args": ["1", `[{"k":"sku_id","v":"${skuId}","c":"like"}]`, "{}"]
                }
                const callBackParamStr = JSON.stringify(callBackParam)
                const params = `__VIEWSTATE=%2FwEPDwUKLTYxMzg5NTU3MWRkpa9oWac5nJUlZdTmtux9W%2F7UGS8%3D&__VIEWSTATEGENERATOR=491FF2E7&sku_id=${skuId}&_jt_page_size=500&__CALLBACKID=JTable1&__CALLBACKPARAM=${encodeURIComponent(callBackParamStr)}`

                try {
                    const res = await Utils.sendHttpRequest('POST', 'https://www.erp321.com/app/item/SkuStock/SkuStock.aspx?_c=jst-epaas&am___=LoadDataToJSON', {
                        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                        'Cookie': erp321Cookie
                    }, params)

                    try {
                        const resJsonStr = res.substring(2)
                        const resJson = JSON.parse(resJsonStr)

                        if (!resJson["IsSuccess"]) {
                            console.warn(`查询SKU ${skuId} 库存失败:`, resJson)
                            return
                        }
                        // console.log(`查询SKU ${skuId} 库存成功:`, resJson)
                        const dataJson = JSON.parse(resJson['ReturnValue'])
                        dataJson['datas'].forEach(skuData => {
                            // 计算可用库存：总库存 - 锁定库存 - 运营云仓库存 - 订单锁定 + 进货仓库存
                            const stockNum = skuData['qty'] - skuData['lock_qty'] - skuData['lwh_result_lock_qty'] - skuData['order_lock'] + skuData['in_qty']
                            // 采购在途 + 采购在途库存
                            const caigouStockNum = skuData['in_qty'] + skuData['purchase_qty']
                            skuStockMap.set(skuData['sku_id'], {
                                "在仓可用库存": stockNum,
                                "采购在途库存": caigouStockNum,
                            })
                        })
                    } catch (parseError) {
                        console.error(`解析SKU ${skuId} 库存数据失败:`, parseError)
                    }
                } catch (err) {
                    console.error(`查询SKU ${skuId} 库存失败:`, err)
                }
            })

            // 等待所有查询完成
            await Promise.all(promises)

            // console.log("批量库存查询完成，结果:", skuStockMap)
            return skuStockMap
        }
    }

    // ========== 配置管理器 ==========
    class ConfigManager {
        constructor() {
            this.configKey = 'douDianToolBoxConfig'
            this.defaultConfig = {
                // 全局配置
                global: {
                    feishuAppId: '',
                    feishuAppSecret: '',
                    juShuiTanCookie: '',
                    juShuiTanAccount: '',
                    juShuiTanPassword: ''
                },
                // 模块开关配置
                modules: {
                    productListModule: true,
                    productEditModule: true,
                    liveModule: true,
                    competingStoreData: true,
                    shopRankModule: true,
                    productData: true,
                    productCardRank: true,
                    qianchuanMaterial: true
                },
                // 店铺榜单模块配置
                shopRankModule: {
                    // 关注的店铺名称列表，逗号分隔
                    followShopNames: ''
                },
                // 竞店数据模块配置
                competingStoreData: {
                    documentId: ''
                },
                // 商品数据模块配置
                productData: {
                    documentId: ''
                }
            }
            this.config = this.deepClone(this.defaultConfig)
        }

        // 获取单例实例
        static getInstance() {
            if (!ConfigManager.instance) {
                ConfigManager.instance = new ConfigManager()
            }
            return ConfigManager.instance
        }

        async init() {
            // 初始化配置管理器
            await this.loadConfig()
            console.log('配置管理器初始化完成')
            GM_registerMenuCommand('设置', () => {
                const settingsModal = new SettingsModal()
                settingsModal.open()
            })
        }

        /**
         * 加载配置
         */
        async loadConfig() {
            try {
                const savedConfig = await GM_getValue(this.configKey)
                console.log('加载到的配置:', savedConfig)
                if (savedConfig) {
                    this.config = this.deepMerge(this.defaultConfig, savedConfig)
                }
            } catch (error) {
                console.error('加载配置失败:', error)
                this.config = this.deepClone(this.defaultConfig)
            }
        }

        /**
         * 保存配置
         */
        async saveConfig() {
            try {
                await GM_setValue(this.configKey, this.config)
                return true
            } catch (error) {
                console.error('保存配置失败:', error)
                return false
            }
        }

        /**
         * 获取配置
         */
        getConfig(path, defaultValue = null) {
            const keys = path.split('.')
            let current = this.config

            for (const key of keys) {
                if (current && typeof current === 'object' && key in current) {
                    current = current[key]
                } else {
                    return defaultValue
                }
            }

            return current !== undefined ? current : defaultValue
        }

        /**
         * 设置配置
         */
        setConfig(path, value) {
            const keys = path.split('.')
            const lastKey = keys.pop()
            let current = this.config

            for (const key of keys) {
                if (!current[key] || typeof current[key] !== 'object') {
                    current[key] = {}
                }
                current = current[key]
            }
            current[lastKey] = value
        }

        /**
         * 获取模块是否启用
         */
        getModuleEnabled(moduleName, defaultValue = true) {
            return this.getConfig(`modules.${moduleName}`, defaultValue)
        }

        /**
         * 设置模块是否启用
         */
        setModuleEnabled(moduleName, enabled) {
            this.setConfig(`modules.${moduleName}`, enabled)
        }

        /**
         * 获取全局配置
         */
        getGlobalConfig(key, defaultValue = '') {
            return this.getConfig(`global.${key}`, defaultValue)
        }

        /**
         * 设置全局配置
         */
        setGlobalConfig(key, value) {
            this.setConfig(`global.${key}`, value)
        }

        /**
         * 获取模块配置
         */
        getModuleConfig(moduleName, key, defaultValue = '') {
            return this.getConfig(`${moduleName}.${key}`, defaultValue)
        }

        /**
         * 设置模块配置
         */
        setModuleConfig(moduleName, key, value) {
            this.setConfig(`${moduleName}.${key}`, value)
        }

        /**
         * 重置配置
         */
        resetConfig() {
            this.config = this.deepClone(this.defaultConfig)
        }

        /**
         * 深度合并对象
         */
        deepMerge(target, source) {
            const result = this.deepClone(target)

            for (const key in source) {
                if (Object.prototype.hasOwnProperty.call(source, key)) {
                    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                        result[key] = this.deepMerge(result[key] || {}, source[key])
                    } else {
                        result[key] = source[key]
                    }
                }
            }

            return result
        }

        /**
         * 深度克隆对象
         */
        deepClone(obj) {
            if (obj === null || typeof obj !== 'object') {
                return obj
            }

            if (obj instanceof Date) {
                return new Date(obj.getTime())
            }

            if (obj instanceof Array) {
                return obj.map(item => this.deepClone(item))
            }

            const cloned = {}
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    cloned[key] = this.deepClone(obj[key])
                }
            }

            return cloned
        }
    }

    // ========== 设置模态框组件 ==========
    class SettingsModal {
        constructor() {
            this.configManager = ConfigManager.getInstance()
            this.moduleRegistry = ModuleRegistryManager.getInstance()
            this.modal = null
            this.isOpen = false
        }

        /**
         * 获取模块配置（从ModuleRegistryManager获取）
         * @returns {Object} - 以moduleId为键的模块配置对象
         */
        getModuleConfigs() {
            return this.moduleRegistry.getAllModuleConfigs()
        }

        /**
         * 创建模态框
         */
        createModal() {
            const modal = document.createElement('div')
            modal.className = 'dou-dian-settings-modal'
            modal.innerHTML = this.getModalHTML()
            document.body.appendChild(modal)
            this.modal = modal
            this.bindEvents()
            return modal
        }

        /**
         * 获取模态框HTML
         */
        getModalHTML() {
            return `
                    <div class="settings-modal-overlay">
                        <div class="settings-modal-content">
                            <div class="settings-modal-header">
                                <h2>抖店工具箱设置</h2>
                                <button class="settings-modal-close">&times;</button>
                            </div>
                            <div class="settings-modal-body">
                                <div class="settings-tabs">
                                    <div class="settings-tab active" data-tab="modules">模块设置</div>
                                    <div class="settings-tab" data-tab="global">全局配置</div>
                                </div>
                                <div class="settings-tab-content">
                                    <div class="settings-tab-panel active" id="modules-panel">
                                        ${this.getModulesPanelHTML()}
                                    </div>
                                    <div class="settings-tab-panel" id="global-panel">
                                        ${this.getGlobalPanelHTML()}
                                    </div>
                                </div>
                            </div>
                            <div class="settings-modal-footer" style="display: flex; justify-content: space-between; align-items: center;">
                                <button class="settings-btn settings-btn-secondary" style="background-color: #fee2e2; color: #dc2626; border-color: #fca5a5;" id="settings-reset">重置配置</button>
                                <div style="display: flex; gap: 8px;">
                                    <button class="settings-btn settings-btn-secondary" id="settings-close">关闭</button>
                                    <button class="settings-btn settings-btn-primary" id="settings-save">保存设置</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <style>
                        .dou-dian-settings-modal {
                            position: fixed;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            z-index: 100000;
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        }
                        .settings-modal-overlay {
                            position: absolute;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            background: rgba(0, 0, 0, 0.5);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        }
                        .settings-modal-content {
                            background: white;
                            border-radius: 8px;
                            width: 600px;
                            max-width: 90%;
                            max-height: 80%;
                            display: flex;
                            flex-direction: column;
                            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                        }
                        .settings-modal-header {
                            padding: 20px;
                            border-bottom: 1px solid #e5e7eb;
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                        }
                        .settings-modal-header h2 {
                            margin: 0;
                            font-size: 20px;
                            font-weight: 600;
                            color: #111827;
                        }
                        .settings-modal-close {
                            background: none;
                            border: none;
                            font-size: 24px;
                            cursor: pointer;
                            color: #6b7280;
                            padding: 0;
                            width: 32px;
                            height: 32px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            border-radius: 4px;
                        }
                        .settings-modal-close:hover {
                            background: #f3f4f6;
                            color: #374151;
                        }
                        .settings-modal-body {
                            flex: 1;
                            overflow: hidden;
                            display: flex;
                            flex-direction: column;
                        }
                        .settings-tabs {
                            display: flex;
                            border-bottom: 1px solid #e5e7eb;
                            padding: 0 20px;
                        }
                        .settings-tab {
                            padding: 12px 16px;
                            cursor: pointer;
                            border-bottom: 2px solid transparent;
                            color: #6b7280;
                            font-weight: 500;
                            transition: all 0.2s;
                        }
                        .settings-tab:hover {
                            color: #374151;
                        }
                        .settings-tab.active {
                            color: #3b82f6;
                            border-bottom-color: #3b82f6;
                        }
                        .settings-tab-content {
                            flex: 1;
                            overflow-y: auto;
                            padding: 20px;
                        }
                        .settings-tab-panel {
                            display: none;
                        }
                        .settings-tab-panel.active {
                            display: block;
                        }
                        .module-item {
                            border: 1px solid #e5e7eb;
                            border-radius: 8px;
                            padding: 16px;
                            margin-bottom: 16px;
                            transition: all 0.2s;
                        }
                        .module-item:hover {
                            border-color: #d1d5db;
                            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
                        }
                        .module-header {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            margin-bottom: 8px;
                        }
                        .module-name {
                            font-weight: 600;
                            color: #111827;
                            font-size: 16px;
                        }
                        .module-switch {
                            position: relative;
                            width: 44px;
                            height: 24px;
                            background: #d1d5db;
                            border-radius: 12px;
                            cursor: pointer;
                            transition: background 0.2s;
                        }
                        .module-switch.active {
                            background: #3b82f6;
                        }
                        .module-switch::after {
                            content: '';
                            position: absolute;
                            width: 20px;
                            height: 20px;
                            background: white;
                            border-radius: 50%;
                            top: 2px;
                            left: 2px;
                            transition: transform 0.2s;
                            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                        }
                        .module-switch.active::after {
                            transform: translateX(20px);
                        }
                        .module-description {
                            color: #6b7280;
                            font-size: 14px;
                            margin-bottom: 12px;
                        }
                        .module-config {
                            border-top: 1px solid #f3f4f6;
                            padding-top: 12px;
                            margin-top: 12px;
                        }
                        .config-field {
                            margin-bottom: 12px;
                        }
                        .config-field:last-child {
                            margin-bottom: 0;
                        }
                        .config-label {
                            display: block;
                            font-size: 14px;
                            font-weight: 500;
                            color: #374151;
                            margin-bottom: 6px;
                        }
                        .config-input {
                            width: 100%;
                            padding: 8px 12px;
                            border: 1px solid #d1d5db;
                            border-radius: 6px;
                            font-size: 14px;
                            transition: border-color 0.2s;
                        }
                        .config-input:focus {
                            outline: none;
                            border-color: #3b82f6;
                            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                        }
                        .config-switch {
                            position: relative;
                            display: inline-block;
                            width: 44px;
                            height: 24px;
                        }
                        .config-switch-input {
                            opacity: 0;
                            width: 0;
                            height: 0;
                        }
                        .config-switch-slider {
                            position: absolute;
                            cursor: pointer;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background-color: #d1d5db;
                            transition: 0.3s;
                            border-radius: 24px;
                        }
                        .config-switch-slider:before {
                            position: absolute;
                            content: "";
                            height: 18px;
                            width: 18px;
                            left: 3px;
                            bottom: 3px;
                            background-color: white;
                            transition: 0.3s;
                            border-radius: 50%;
                        }
                        .config-switch-input:checked + .config-switch-slider {
                            background-color: #3b82f6;
                        }
                        .config-switch-input:checked + .config-switch-slider:before {
                            transform: translateX(20px);
                        }
                        .global-config-item {
                            margin-bottom: 20px;
                        }
                        .global-config-item:last-child {
                            margin-bottom: 0;
                        }
                        .settings-modal-footer {
                            padding: 20px;
                            border-top: 1px solid #e5e7eb;
                            display: flex;
                            justify-content: flex-end;
                            gap: 12px;
                        }
                        .settings-btn {
                            padding: 8px 16px;
                            border-radius: 6px;
                            font-size: 14px;
                            font-weight: 500;
                            cursor: pointer;
                            border: none;
                            transition: all 0.2s;
                        }
                        .settings-btn-primary {
                            background: #3b82f6;
                            color: white;
                        }
                        .settings-btn-primary:hover {
                            background: #2563eb;
                        }
                        .settings-btn-secondary {
                            background: #f3f4f6;
                            color: #374151;
                            border: 1px solid #d1d5db;
                        }
                        .settings-btn-secondary:hover {
                            background: #e5e7eb;
                        }
                    </style>
                `
        }

        /**
         * 获取模块面板HTML
         */
        getModulesPanelHTML() {
            let html = ''
            const moduleConfigs = this.getModuleConfigs()
            for (const [moduleId, config] of Object.entries(moduleConfigs)) {
                const enabled = this.configManager.getModuleEnabled(moduleId, this.moduleRegistry.getModuleEnabled(moduleId))
                const hasConfig = config.configFields && config.configFields.length > 0
                html += `
                        <div class="module-item" data-module="${moduleId}">
                            <div class="module-header">
                                <div class="module-name">${config.name}</div>
                                <div class="module-switch ${enabled ? 'active' : ''}" data-module="${moduleId}"></div>
                            </div>
                            <div class="module-description">${config.description}</div>
                            ${hasConfig ? this.getModuleConfigHTML(moduleId, config.configFields) : ''}
                        </div>
                    `
            }
            return html
        }

        /**
         * 获取模块配置HTML
         */
        getModuleConfigHTML(moduleId, configFields) {
            let html = '<div class="module-config">'
            for (const field of configFields) {
                const value = this.configManager.getModuleConfig(moduleId, field.key) !== undefined ? this.configManager.getModuleConfig(moduleId, field.key) : field.defaultValue
                const fieldType = field.type || 'text'

                html += `
                        <div class="config-field">
                            <label class="config-label">${field.label}</label>
                            ${this.generateConfigFieldHTML(moduleId, field, value, fieldType)}
                        </div>
                    `
            }
            html += '</div>'
            return html
        }

        generateConfigFieldHTML(moduleId, field, value, fieldType) {
            if (fieldType === 'switch') {
                return `
                    <div class="config-switch">
                        <input type="checkbox" class="config-switch-input" 
                            data-module="${moduleId}" 
                            data-field="${field.key}"
                            ${value ? 'checked' : ''}>
                        <span class="config-switch-slider"></span>
                    </div>
                `
            } else {
                return `
                    <input type="text" class="config-input" 
                        data-module="${moduleId}" 
                        data-field="${field.key}"
                        placeholder="${field.placeholder || ''}"
                        value="${value}">
                `
            }
        }

        /**
         * 获取全局配置面板HTML
         */
        getGlobalPanelHTML() {
            const globalConfig = this.configManager.getConfig('global')
            return `
                    <div class="global-config-item">
                        <label class="config-label">飞书APP ID</label>
                        <input type="text" class="config-input" 
                            data-global="feishuAppId"
                            placeholder="请输入飞书APP ID"
                            value="${globalConfig.feishuAppId || ''}">
                    </div>
                    <div class="global-config-item">
                        <label class="config-label">飞书APP Secret</label>
                        <input type="text" class="config-input" 
                            data-global="feishuAppSecret"
                            placeholder="请输入飞书APP Secret"
                            value="${globalConfig.feishuAppSecret || ''}">
                    </div>
                    <div class="global-config-item">
                        <label class="config-label">钉钉APP Key</label>
                        <input type="text" class="config-input" 
                            data-global="dingtalkAppKey"
                            placeholder="请输入钉钉APP KEY"
                            value="${globalConfig.dingtalkAppKey || ''}">
                    </div>
                    <div class="global-config-item">
                        <label class="config-label">钉钉APP Secret</label>
                        <input type="text" class="config-input" 
                            data-global="dingtalkAppSecret"
                            placeholder="请输入钉钉APP Secret"
                            value="${globalConfig.dingtalkAppSecret || ''}">
                    </div>
                    <div class="global-config-item">
                        <label class="config-label">钉钉OperatorId</label>
                        <input type="text" class="config-input" 
                            data-global="dingtalkOperatorId"
                            placeholder="请输入钉钉OperatorId"
                            value="${globalConfig.dingtalkOperatorId || ''}">
                    </div>
                    <div class="global-config-item">
                        <label class="config-label">聚水潭账号</label>
                        <input type="text" class="config-input" 
                            data-global="juShuiTanAccount"
                            placeholder="请输入聚水潭账号"
                            value="${globalConfig.juShuiTanAccount || ''}">
                    </div>
                    <div class="global-config-item">
                        <label class="config-label">聚水潭密码</label>
                        <input type="password" class="config-input" 
                            data-global="juShuiTanPassword"
                            placeholder="请输入聚水潭密码"
                            value="${globalConfig.juShuiTanPassword || ''}">
                    </div>
                    <div class="global-config-item">
                        <label class="config-label">聚水潭Cookie</label>
                        <input type="text" class="config-input" 
                            data-global="juShuiTanCookie"
                            placeholder="请输入聚水潭Cookie（自动登录后会自动填充）"
                            value="${globalConfig.juShuiTanCookie || ''}">
                    </div>
                    <div class="global-config-item">
                        <button type="button" class="settings-btn settings-btn-primary" id="juShuiTanAutoLogin">
                            聚水潭登录
                        </button>
                    </div>
                `
        }

        /**
         * 绑定事件
         */
        bindEvents() {
            // 关闭按钮
            this.modal.querySelector('.settings-modal-close').addEventListener('click', () => this.close())

            // 点击遮罩关闭
            this.modal.querySelector('.settings-modal-overlay').addEventListener('click', (e) => {
                // if (e.target === e.currentTarget) this.close()
            })

            // 标签切换
            this.modal.querySelectorAll('.settings-tab').forEach(tab => {
                tab.addEventListener('click', (e) => {
                    const tabName = e.target.dataset.tab
                    this.switchTab(tabName)
                })
            })

            // 模块开关
            this.modal.querySelectorAll('.module-switch').forEach(switchEl => {
                switchEl.addEventListener('click', (e) => {
                    const moduleId = e.target.dataset.module
                    this.toggleModule(moduleId)
                })
            })

            // 保存按钮
            this.modal.querySelector('#settings-save').addEventListener('click', () => this.saveSettings())

            // 重置按钮
            this.modal.querySelector('#settings-reset').addEventListener('click', () => this.resetSettings())

            // 关闭按钮
            this.modal.querySelector('#settings-close').addEventListener('click', () => this.close())

            // 聚水潭自动登录按钮
            const juShuiTanAutoLoginBtn = this.modal.querySelector('#juShuiTanAutoLogin')
            if (juShuiTanAutoLoginBtn) {
                juShuiTanAutoLoginBtn.addEventListener('click', () => this.handleJuShuiTanAutoLogin())
            }
        }

        /**
         * 切换标签
         */
        switchTab(tabName) {
            this.modal.querySelectorAll('.settings-tab').forEach(tab => tab.classList.remove('active'))
            this.modal.querySelectorAll('.settings-tab-panel').forEach(panel => panel.classList.remove('active'))

            this.modal.querySelector(`[data-tab="${tabName}"]`).classList.add('active')
            this.modal.querySelector(`#${tabName}-panel`).classList.add('active')
        }

        /**
         * 切换模块开关
         */
        toggleModule(moduleId) {
            const switchEl = this.modal.querySelector(`.module-switch[data-module="${moduleId}"]`)
            const enabled = switchEl.classList.contains('active')

            if (enabled) {
                switchEl.classList.remove('active')
            } else {
                switchEl.classList.add('active')
            }
        }

        /**
         * 保存设置
         */
        saveSettings() {
            try {
                // 保存模块开关
                this.modal.querySelectorAll('.module-switch').forEach(switchEl => {
                    const moduleId = switchEl.dataset.module
                    const enabled = switchEl.classList.contains('active')
                    this.configManager.setModuleEnabled(moduleId, enabled)
                    // 刷新模块状态
                    ModuleRegistryManager.getInstance().setModuleEnabled(moduleId, enabled)
                })

                // 保存模块配置
                this.modal.querySelectorAll('.config-input[data-module]').forEach(input => {
                    const moduleId = input.dataset.module
                    const field = input.dataset.field
                    const value = input.value.trim()
                    this.configManager.setModuleConfig(moduleId, field, value)
                })

                // 保存模块配置（switch类型）
                this.modal.querySelectorAll('.config-switch-input[data-module]').forEach(input => {
                    const moduleId = input.dataset.module
                    const field = input.dataset.field
                    const value = input.checked
                    this.configManager.setModuleConfig(moduleId, field, value)
                })

                // 保存全局配置
                this.modal.querySelectorAll('.config-input[data-global]').forEach(input => {
                    const key = input.dataset.global
                    const value = input.value.trim()
                    this.configManager.setGlobalConfig(key, value)
                })
                this.configManager.saveConfig()
                // 初始化飞书API
                FeishuAPI.init({
                    appId: this.configManager.getGlobalConfig('feishuAppId'),
                    appSecret: this.configManager.getGlobalConfig('feishuAppSecret')
                })
                UI.showMessage('success', '设置保存成功！')
                this.close()
            } catch (error) {
                console.error('保存设置失败:', error)
                UI.showMessage('error', '保存设置失败，请重试！')
            }
        }

        /**
         * 重置设置
         */
        resetSettings() {
            if (confirm('确定要重置所有配置吗？此操作不可撤销。')) {
                this.configManager.resetConfig()
                this.refreshUI()
                UI.showMessage('success', '配置已重置！')
            }
        }

        /**
         * 刷新UI
         */
        refreshUI() {
            // 刷新模块开关
            this.modal.querySelectorAll('.module-switch').forEach(switchEl => {
                const moduleId = switchEl.dataset.module
                const enabled = this.configManager.getModuleEnabled(moduleId, this.moduleRegistry.getModuleEnabled(moduleId))
                if (enabled) {
                    switchEl.classList.add('active')
                } else {
                    switchEl.classList.remove('active')
                }
            })

            // 刷新模块配置
            this.modal.querySelectorAll('.config-input[data-module]').forEach(input => {
                const moduleId = input.dataset.module
                const field = input.dataset.field
                const value = this.configManager.getModuleConfig(moduleId, field) || ''
                input.value = value
            })

            // 刷新模块配置（switch类型）
            this.modal.querySelectorAll('.config-switch-input[data-module]').forEach(input => {
                const moduleId = input.dataset.module
                const field = input.dataset.field
                const value = this.configManager.getModuleConfig(moduleId, field)
                input.checked = value === true
            })

            // 刷新全局配置
            this.modal.querySelectorAll('.config-input[data-global]').forEach(input => {
                const key = input.dataset.global
                const value = this.configManager.getGlobalConfig(key) || ''
                input.value = value
            })
        }

        /**
         * 处理聚水潭自动登录
         */
        async handleJuShuiTanAutoLogin() {
            try {
                this.saveSettings()
                const globalConfig = this.configManager.getConfig('global')
                const account = globalConfig.juShuiTanAccount
                const password = globalConfig.juShuiTanPassword

                if (!account || !password) {
                    UI.showMessage('warning', '请先填写聚水潭账号和密码！')
                    return
                }

                // 显示加载状态
                const loginBtn = this.modal.querySelector('#juShuiTanAutoLogin')
                loginBtn.textContent = '登录中...'
                loginBtn.disabled = true

                // 执行自动登录
                const result = await JuShuiTanTool.getInstance().autoLogin()

                if (result.success) {
                    UI.showMessage('success', '聚水潭自动登录成功！')
                    // 刷新UI以显示新的cookie
                    this.refreshUI()
                } else {
                    UI.showMessage('error', result.message || '聚水潭自动登录失败！')
                }
            } catch (error) {
                console.error('聚水潭自动登录失败:', error)
                UI.showMessage('error', '聚水潭自动登录失败：' + error.message)
            } finally {
                // 恢复按钮状态
                const loginBtn = this.modal.querySelector('#juShuiTanAutoLogin')
                loginBtn.textContent = '聚水潭自动登录'
                loginBtn.disabled = false
            }
        }

        /**
         * 打开模态框
         */
        open() {
            if (!this.modal) {
                this.createModal()
            }
            this.modal.style.display = 'block'
            this.isOpen = true
            this.refreshUI()
        }

        /**
         * 关闭模态框
         */
        close() {
            if (this.modal) {
                this.modal.style.display = 'none'
                this.isOpen = false
            }
        }
    }

    // ========== 初始化应用 ==========

    window.douDianTool = new DouDianToolBox()


})()
