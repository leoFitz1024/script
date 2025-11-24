// ==UserScript==
// @name         抖店工具箱合并版
// @version      3.0.0
// @description  抖店增强工具箱 网页功能增强
// @author       xchen
// @match        https://*.jinritemai.com/*
// @icon         https://lf1-fe.ecombdstatic.com/obj/eden-cn/upqphj/homepage/icon.svg
// @updateURL    https://cdn.jsdmirror.com/gh/leoFitz1024/script@latest/DouYinTools.js
// @downloadURL  https://cdn.jsdmirror.com/gh/leoFitz1024/script@latest/DouYinTools.js
// @connect      www.erp321.com
// @connect      open.feishu.cn
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
        sendHttpRequest(method, url, headers = {}, data = null) {
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
                console.log(method, url, defaultHeaders, requestData)
                GM_xmlhttpRequest({
                    method: method,
                    url: url,
                    headers: defaultHeaders,
                    data: requestData,
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
                        UI.showMessage('error', `Request error: ${error}`)
                        reject(new Error(`Request error: ${error}`))
                    }
                })
            })
        },

        /**
         * 等待元素出现
         */
        waitForElementByXPath(xpath, timeout = 10000) {
            return new Promise((resolve, reject) => {
                const element = document.evaluate(
                    xpath, document, null,
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
                        doReject(new Error(`无法观察目标节点: ${error.message}`))
                        return
                    }

                    // 设置超时
                    timeoutId = setTimeout(() => {
                        doReject(new Error(`等待元素超时: ${xpath}`))
                    }, timeout)
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

                    // 设置超时（等待 DOM 加载）
                    timeoutId = setTimeout(() => {
                        doReject(new Error(`等待元素超时: ${xpath} (DOM未加载)`))
                    }, timeout)
                } else {
                    startObserving(observeTarget)
                }
            })
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
                console.log('Observe: 开始监听元素变化', element)
            }

            const stopObserving = () => {
                if (observer && isObserving) {
                    observer.disconnect()
                    clearTimeout(mutationTimeout)
                    isObserving = false
                    console.log('Observe: 停止监听元素变化', element)
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
            popup.style.zIndex = '10000'
            popup.innerText = message

            document.body.appendChild(popup)

            setTimeout(() => {
                popup.remove()
            }, 3000)
        },

        /**
         * 添加悬浮按钮
         */
        addFloatingButton(text, callback) {
            const button = document.createElement('button')
            button.innerText = text
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
            document.body.appendChild(button)

            button.addEventListener('click', () => {
                callback()
            })

            return button
        },

    }

    // ========== 飞书文档操作 ==========
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
         * @param {Object} options - 可选配置 { priority: 优先级(数字越大优先级越高), enabled: 是否启用(默认true) }
         */
        registerModule(moduleId, urlPattern, moduleFactory, cleanupCallback, options = {}) {
            const moduleConfig = {
                id: moduleId,
                urlPattern: urlPattern,
                factory: moduleFactory,
                cleanup: cleanupCallback,
                instance: null,
                priority: options.priority || 0,
                enabled: options.enabled !== undefined ? options.enabled : true,
            }

            // 存储模块配置
            this.modules.set(moduleId, moduleConfig)

            // 按URL模式分组
            if (!this.urlModules.has(urlPattern)) {
                this.urlModules.set(urlPattern, [])
            }
            this.urlModules.get(urlPattern).push(moduleId)

            console.log(`模块注册成功: ${moduleId} (优先级: ${moduleConfig.priority})`)
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
                                method: "GET",
                                url,
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

    // ========== 商品列表增强 ==========
    class ProductListModule {
        static moduleId = 'productListModule'

        constructor(requestListenerManager) {
            this.productMap = new Map()
            this.requestListenerManager = requestListenerManager
            this.listeners = []
        }

        init() {
            this.setupRequestListeners()
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

            console.log('商品列表增强模块已销毁')
        }
        /* ================= 插件：商品列表增强显示货号 ========================== */
        // 监听商品列表请求，更新商品编码映射
        setupRequestListeners() {
            // 监听商品列表请求
            const listenerId = this.requestListenerManager.addListener('productList', /\/product\/tproduct\/list\?/, (url, responseText) => {
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
                    const clickInventory = event.target.closest('.ecom-g-table-cell.style_totalInventory__ITuCz a');
                    if (clickInventory) {
                        Utils.waitForElementByXPath("//div[@class='index_filterBox__xQbII']", 5000).then((filterBox) => {
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
                        if (header[2] && header[2]['name'].includes("天内发货")) {
                            console.log("不符合条件，跳过:", header[2]['name'], code)
                            return
                        }

                        let stockGetNum = stockMap.get(code)
                        if (stockGetNum < 0) {
                            stockGetNum = 0
                        }

                        let lastNum = rowData.num
                        rowData.num = stockGetNum + ''
                        fc.root.emit()
                        console.log(`skuId:${code}，更新库存:${lastNum}===》${stockGetNum}`)
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

    // ===============================
    class ProductEditModule {
        static moduleId = 'productEditModule'

        constructor() {
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
            Utils.waitForElementByXPath("//div[@id='full-screen-card']", 5000).then((element) => {
                element.prepend(toolDiv)
            })

            showModalBtn.addEventListener('click', () => {
                showModalBtn.scrollIntoView({ behavior: 'smooth', block: 'start' })
                //处理是否完成标记
                let isCompleted = false

                // 表格sku行数据
                const eTableEles = document.querySelectorAll('div.ecom-g-table-container')
                //有时候是第二个表格
                let values = Object.values(eTableEles[1]);
                //必须取第一个元素
                const fiberNode = values[0]
                const tableRows = fiberNode.memoizedProps.children.props.children[1].props.data
                console.log(tableRows)

                //获取颜色数据
                const skuColorEle = document.querySelector('#skuValue-颜色分类')
                const colorValues = Object.values(skuColorEle)[0].memoizedProps.children.props.form.value._value
                const colorMap = {}
                colorValues.forEach(colorValue => {
                    colorMap[colorValue.id] = colorValue.name
                })

                //获取发货时间数据
                const timeEle = document.querySelector('.style_timeSpecCheckboxGroup__fwkzP')
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
    class LiveModule {
        static moduleId = 'liveModule'

        constructor(requestListenerManager) {
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

            const navHeaders = document.getElementsByClassName('panelHeader-ln_vsr')
            if (navHeaders.length > 0) {
                navHeaders[0].insertBefore(toggleContainer, navHeaders[0].lastChild)
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
                    const goodsTextContainer = item.querySelector('.right-mXg75w')
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

    // ========== 运营工具功能类 ==========
    // 竞店数据获取
    class CompetingStoreDataModule {
        static moduleId = 'competingStoreData'

        constructor(sheetToken, requestManager) {
            this.sheetToken = sheetToken
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
            UI.addFloatingButton('采集数据', () => this.writeDataToFeiShuOnlineExcel(this.targetDataArr))
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
    class ProductDataModule {
        static moduleId = 'productData'

        constructor(sheetToken, requestManager = RequestManager) {
            this.sheetToken = sheetToken
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
    class ProductCardRankModule {

        static moduleId = 'productCardRankModule'

        constructor(requestManager) {
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
    class ShopRankModule {
        static moduleId = 'shopRankModule'

        constructor(requestManager) {
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
            const followShopNames = ConfigManager.getInstance().getModuleConfig('shopRankModule', 'followShopNames')
            if (!followShopNames || followShopNames.trim() === '') {
                UI.showMessage('error', '请先配置关注店铺名称')
                return
            }
            if (followShopNames) {
                this.followShopNames = new Set(followShopNames.split(',').map(s => s.trim()).filter(s => s))
            }
            //等待ecom-spin-container元素出现
            Utils.waitForElementByXPath('//div[@class="ecom-spin-container"]', 5000).then(spinContainer => {
                this.floatingButton = UI.addFloatingButton('采集关注店铺', () => {
                    this.floatingButton.disabled = true;
                    this.startCollecting()
                    this.floatingButton.innerText = '数据采集中...'
                    // 按钮颜色变成不可点击的颜色
                    this.floatingButton.style.backgroundColor = '#cccccc';
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
            const followShopNames = ConfigManager.getInstance().getModuleConfig('shopRankModule', 'followShopNames')
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
                const feishuDocId = ConfigManager.getInstance().getModuleConfig('shopRankModule', 'feishuDocId')
                const feishuSheetId = ConfigManager.getInstance().getModuleConfig('shopRankModule', 'feishuSheetId')
                if (!feishuDocId || feishuDocId.trim() === '' || !feishuSheetId || feishuSheetId.trim() === '') {
                    UI.showMessage('error', '请先配置飞书文档ID和工作表ID')
                    return
                }

                // 1. 读取第一行(表头)数据,确定日期列
                console.log('正在读取表头数据...');
                const headerRange = `${feishuSheetId}!A1:ZZ1`; // 读取第一行,假设不超过ZZ列
                const headerData = await FeishuAPI.readRange(feishuDocId, headerRange, {
                    dateTimeRenderOption: 'FormattedString'
                });
                if (!headerData || headerData.length === 0) {
                    UI.showMessage('error', '读取表头数据失败')
                    return
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
                    UI.showMessage('error', '读取店铺名称列失败')
                    return
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
                console.error(`写入数据时出错: }`, error)
                UI.showMessage('error', `写入数据时出错: ${error.message}`)
            }
        }
    }

    // 千川素材分析页监听
    class QianchuanMaterialModule {
        static moduleId = 'qianchuanMaterial'

        constructor(requestManager = RequestManager) {
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
                }
            )

            // 罗盘竞店数据页面模块
            this.moduleManager.registerModule(
                CompetingStoreDataModule.moduleId,
                /compass\.jinritemai\.com\/shop\/chance\/rank-shop\/detail/,
                () => {
                    console.log('初始化罗盘竞店数据模块')
                    const module = new CompetingStoreDataModule(this.configManager.getModuleConfig('competingStoreData', 'documentId'), this.requestListenerManager)
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
                }
            )

            // 商品数据抓取页面模块
            this.moduleManager.registerModule(
                ProductDataModule.moduleId,
                /compass\.jinritemai\.com\/shop\/commodity\/product-list/,
                () => {
                    console.log('初始化商品数据抓取模块')
                    const module = new ProductDataModule(this.configManager.getModuleConfig('productData', 'documentId'), this.requestListenerManager)
                    module.init()
                    return module
                },
                (module) => {
                    console.log('清理商品数据抓取模块')
                    if (module && module.destroy) {
                        module.destroy()
                    }
                },
                {
                    priority: 0,
                    enabled: this.configManager.getModuleEnabled(ProductDataModule.moduleId),
                }
            )

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
                }
            )

            // 千川素材分析页面模块
            this.moduleManager.registerModule(
                QianchuanMaterialModule.moduleId,
                /qianchuan\.jinritemai\.com\/dataV2\/roi2-material-analysis/,
                () => {
                    console.log('初始化千川素材分析监听模块')
                    const module = new QianchuanMaterialModule(this.requestListenerManager)
                    module.init()
                    return module
                },
                (module) => {
                    console.log('清理千川素材分析监听模块')
                    if (module && module.destroy) {
                        module.destroy()
                    }
                },
                {
                    priority: 0,
                    enabled: this.configManager.getModuleEnabled(QianchuanMaterialModule.moduleId),
                }
            )

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

                // 尝试从cookie中提取用户信息
                const userInfoFromCookie = this.extractUserInfoFromCookie(this.cookie)
                console.log('从cookie提取的用户信息:', userInfoFromCookie)

                // 获取用户信息来验证登录状态
                let uid = userInfoFromCookie.uId
                let coid = userInfoFromCookie.uCoId

                if (!this.cookie || !uid || !coid) {
                    return { valid: false, message: '没有Cookie或用户ID或公司ID' }
                }

                const requestData = {
                    data: {},
                    uid: parseInt(uid),
                    coid: parseInt(coid)
                }

                console.log('验证登录状态，请求数据:', requestData)

                // 使用POST请求获取用户信息
                const response = await Utils.sendHttpRequest('POST',
                    `${this.baseURL}/erp/webapi/UserApi/Passport/GetUserInfo`,
                    {
                        'accept': 'application/json',
                        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
                        'content-type': 'application/json;charset=UTF-8',
                        'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Microsoft Edge";v="138"',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0',
                        'Cookie': this.cookie
                    },
                    requestData
                )

                console.log('验证登录状态API响应:', response)
                const result = JSON.parse(response)

                // 根据返回的code判断登录状态
                if (result.code === 0) {
                    console.log('登录状态验证成功，用户信息:', result.data)
                    return { valid: true, message: '登录状态正常', data: result.data }
                } else {
                    console.log('登录状态验证失败:', result.msg)
                    return { valid: false, message: result.msg || '登录已失效' }
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
                const params = `__VIEWSTATE=%2FwEPDwUKMTkyMTExMDQ5NWRk9w9%2BBwzZIG166vk7VBNHl%2B9FDaU%3D&__VIEWSTATEGENERATOR=491FF2E7&sku_id=${skuId}&_jt_page_size=500&__CALLBACKID=JTable1&__CALLBACKPARAM=${encodeURIComponent(callBackParamStr)}`

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

                        const dataJson = JSON.parse(resJson['ReturnValue'])
                        dataJson['datas'].forEach(skuData => {
                            // 计算可用库存：总库存 - 锁定库存 - 运营云仓库存 - 订单锁定 + 在途库存
                            const stockNum = skuData['qty'] - skuData['lock_qty'] - skuData['lwh_result_lock_qty'] - skuData['order_lock'] + skuData['in_qty']
                            skuStockMap.set(skuData['sku_id'], stockNum)
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

            console.log("批量库存查询完成，结果:", skuStockMap)
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
                    documentId: 'W84hsr7FchOkdVtzcPucwUp1nQh'
                },
                // 商品数据模块配置
                productData: {
                    documentId: 'LbsmsnCiihflHDtvnAWc6ITLn50'
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
        getModuleEnabled(moduleName) {
            return this.getConfig(`modules.${moduleName}`, true)
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
            this.modal = null
            this.isOpen = false
            this.moduleConfigs = {
                productListModule: {
                    name: '商品列表增强',
                    description: '增加商品货号显示、库存弹窗一件同步现货库存。'
                },
                productEditModule: {
                    name: '商品编辑增强',
                    description: '增加批量设置商品编码功能'
                },
                liveModule: {
                    name: '直播列表增强',
                    description: '直播列表显示货号、自动讲解功能'
                },
                competingStoreData: {
                    name: '竞店数据抓取',
                    description: '抓取竞店数据到飞书文档',
                    hasConfig: true,
                    configFields: [
                        { key: 'feishuDocId', label: '飞书文档ID', placeholder: '请输入飞书文档ID' }
                    ]
                },
                shopRankModule: {
                    name: '罗盘竞店榜单',
                    description: '一键显示关注店铺排名，意见更新在线表格',
                    hasConfig: true,
                    configFields: [
                        { key: 'followShopNames', label: '关注店铺名称', placeholder: '多个店铺用逗号分隔' },
                        { key: 'feishuDocId', label: '飞书文档ID', placeholder: '请输入飞书文档ID' },
                        { key: 'feishuSheetId', label: '飞书工作表ID', placeholder: '请输入飞书工作表ID' }
                    ]
                },
                productData: {
                    name: '商品数据抓取',
                    description: '抓取商品数据到飞书文档',
                    hasConfig: true,
                    configFields: [
                        { key: 'feishuDocId', label: '飞书文档ID', placeholder: '请输入飞书文档ID' }
                    ]
                },
                productCardRank: {
                    name: '商品卡榜单',
                    description: '商品卡榜单数据分析'
                },
                qianchuanMaterial: {
                    name: '千川素材分析',
                    description: '千川广告素材分析功能'
                }
            }
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
            for (const [moduleId, config] of Object.entries(this.moduleConfigs)) {
                const enabled = this.configManager.getModuleEnabled(moduleId)
                html += `
                        <div class="module-item" data-module="${moduleId}">
                            <div class="module-header">
                                <div class="module-name">${config.name}</div>
                                <div class="module-switch ${enabled ? 'active' : ''}" data-module="${moduleId}"></div>
                            </div>
                            <div class="module-description">${config.description}</div>
                            ${config.hasConfig ? this.getModuleConfigHTML(moduleId, config.configFields) : ''}
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
                const value = this.configManager.getModuleConfig(moduleId, field.key) || ''
                html += `
                        <div class="config-field">
                            <label class="config-label">${field.label}</label>
                            <input type="text" class="config-input" 
                                data-module="${moduleId}" 
                                data-field="${field.key}"
                                placeholder="${field.placeholder}"
                                value="${value}">
                        </div>
                    `
            }
            html += '</div>'
            return html
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
                const enabled = this.configManager.getModuleEnabled(moduleId)
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
