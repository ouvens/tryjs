
(function () {

    var config = {
        id: 0,  // 业务id
        uin: 0, // user id
        reportUrl: '//e.qq.com/phoenix/api.php?mod=monitor&act=front', // 上报地址接口

        offline_url: '', // 离线日志上报 接口
        offline_auto_url: '', // 检测是否自动上报
        ext: null, // 扩展参数 用于自定义上报
        level: 4, // 错误级别 1-debug 2-info 4-error

        ignore: [], // 忽略某个错误, 支持 Regexp
        random: 1, // 抽样 (0-1] 1-全量上报
        delay: 1000, // 延迟上报 combo 为 true 时有效
        submit: null, // 自定义上报方式
        extension: {}
        // repeat: 2 , // 重复上报次数(对于同一个错误超过多少次不上报),
        // offlineLog : true,
        // offlineLogExp : 5,  // 离线日志过期时间 ， 默认5天
        // offlineLogAuto : false,  //是否自动询问服务器需要自动上报
    };

    var _errorProcess = _reportError,
        Tryjs = Tryjs || {
            defineError: defineError,

            /**
             * 初始化方法
             * 传入config中的参数覆盖
             */
            init: function init(options) {

                // 融合全局方法定义
                var defaultFnArray = ['require', 'define', 'setTimeout', 'setInterval'],
                    i,
                    length,
                    fnObject = options && options.fnObject || [];

                for (i = 0, length = fnObject.length; fnObject.length && i < length && defaultFnArray.indexOf(fnObject[i]) < 0; i++) {
                    defaultFnArray.push(fnObject[i]);
                }

                // 初始化属性配置 
                config.id = options.id || config.id;
                config.reportUrl = options.reportUrl || config.reportUrl;
                config.random = options.random || 1;
                config.ignore = options.ignore || [];
                config.uinExtension = options.uinExtension || {};

                _errorProcess = options && options.error || _reportError;
                // 定义初始化函数方法
                defineError(defaultFnArray, window);
            },

            /**
             * 上报对象，包括一组key和值，例如
             * 
             * @param {any} data 上报的对象
             * {
             *   name: 'name',
             *   msg: '这是一个异常上报消息'
             * }
             */
            report: function (data) {
                var errorObj = {
                    name: data.name || '自定义上报',
                    stack: data.msg || data || ''
                }
                // 如果配置了config.id则上报，否则不上报
                if (config.id) {
                    _reportError(errorObj)
                }
            }
        };

    // 如果浏览支持Promise，捕获promise里面then的报错，因为promise里面的错误onerror和try-catch都无法捕获
    if (Promise && Promise.prototype.then) {
        var promiseThen = Promise.prototype.then;

        Promise.prototype.then = function (resolve, reject) {
            return promiseThen.call(this, _wrapPromiseFunction(resolve), _wrapPromiseFunction(reject));
        }
    }

    /**
     * window.onerror的错误上报，try-catch会跳过并上报过程中遇到的问题，之外的问题则由onerror全局捕获
     * 
     * @param {any} msg 错误信息
     * @param {any} file 文件路径
     * @param {any} row 行数
     * @param {any} col 列数
     * @param {any} errorObj 错误对象，兼容safari浏览器
     */
    if (window.attachEvent) {
        window.attachEvent('error', _onErrorHandler, true);
    } else {
        window.addEventListener('error', _onErrorHandler, true);
    }

    /**
     * 
     * @param {any} fnObject 函数方法数组或单个函数方法名称;当为函数方法名时，执行返回内容带try...catch的函数
     * @param {any} scope 当前的作用域this
     * @returns object 返回函数
     */
    function defineError(fnObject, scope) {

        var type = Object.prototype.toString.call(fnObject).slice(8, -1).toLowerCase(),
            i,
            length;

        if (type === 'array') {
            for (i = 0, length = fnObject.length; i < length; i++) {
                fnObject[i] && _wrapFunctionArray(fnObject[i], scope);
            }
            return true;
        } else if (type === 'string') {
            return _wrapFunction(scope[fnObject]);
        } else if (type === 'object') {
            //  对于对象，则包裹它的方法属性，主要针对react的方法实现，需要重新定义原有方法
            for (var key in fnObject) {
                if (typeof fnObject[key] === 'function') {
                    fnObject[key] = _wrapFunction(fnObject[key], scope || fnObject);
                }
            }
            return fnObject;
        } else if (type === 'function' && (fnObject.prototype.isReactComponent /* ES5代码中的判断 */ || fnObject.__proto__.prototype.isReactComponent /* ES6代码中的判断 */)) {
            // 可能是真正的函数或者是class, ES6的class type也是function，如果含有。
            return _defineReact(fnObject);
        } else if (type === 'function') {
            // 可能是真正的函数或者是class, ES6的class type也是function
            return _wrapFunction(fnObject, scope || fnObject);
        } else {
            return function () { };
        }
    }

    /**
     * 封装React方法的错误处理,改成使用入参的prototype中是否有render生命周期函数来判断
     * @param  {object} Component 传入组件
     * @return {object} 返回包裹后的组件
     */
    function _defineReact(Component) {

        var proto = Component.prototype;
        var key;

        // 封装本身constructor中的构造方法，React组件编译为ES5后是一个构造函数，ES6下面为class
        if (_isTrueFunction(Component)) {
            Component = _wrapFunction(Component);
        }

        var componnetKeys = Object.getOwnPropertyNames(proto);

        // 支持ES6类的属性方法错误捕获
        for (var i = 0, len = componnetKeys.length; i < len; i++) {
            key = componnetKeys[i];
            proto[key] = _wrapFunction(proto[key])
        }

        // 支持ES5下的属性方法错误捕获
        for (key in proto) {
            if (typeof proto[key] === 'function') {
                proto[key] = _wrapFunction(proto[key]);
            }
        }

        return Component;
    }

    /**
     * 输入一个函数，将函数内代码包裹进try-catch执行，ES5写法
     * 
     * @param {any} fn 
     * @returns 一个新的函数
     */
    function _wrapFunction(fn) {
        // 如果fn是个函数，则直接放到try-catch中运行，否则要将类的方法包裹起来

        if (typeof fn !== 'function') {
            return function () { };
        }

        return function () {
            try {
                return fn.apply(this, arguments);
            } catch (e) {
                _errorProcess(e);
                throw e;
            }
        };
    }

    /**
     * 判断是否为真实的函数，而不是class
     * @param  {Function} fn [description]
     * @return {Boolean}     [description]
     */
    function _isTrueFunction(fn) {

        var isTrueFunction = false;

        try {
            isTrueFunction = fn.prototype.constructor.arguments === null;
        } catch (e) {
            isTrueFunction = false;
        }

        for (var key in fn.prototype) {
            return false;
        }
        return isTrueFunction;
    }

    /**
     * 包裹scope作用域下的属性函数，对通用入口函数内容包裹后运行
     * 
     * @param {any} fnName 原始函数名
     * @param {any} scope 作用域
     * @returns function 返回新的函数
     */
    function _wrapFunctionArray(fnName, scope) {

        var _newFn = _wrapFunction(scope[fnName]) || function () { };

        if (typeof scope[fnName] !== 'function') {
            return function () { };
        }

        /*重定义对应的常用入口方法函数*/
        /*if (['require', 'define'].indexOf(fnName) >= 0) {
            scope[fnName] = function (id, deps, factory) {

                if (typeof factory !== 'function' || !factory) {
                    return _newFn(id, deps);
                } else {
                    return _newFn(id, deps, _wrapFunction(factory));
                }
            };
        } else  */
        if (['setInterval', 'setTimeout'].indexOf(fnName) >= 0) {
            scope[fnName] = function (fn, time) {
                // ES6 的语法
                return _newFn(_wrapFunction(fn), time);
            };
        } else if (['on'].indexOf(fnName) >= 0) {
            scope[fnName] = function (eventName, subElem, fn) {
                if (typeof fn !== 'function' || !fn) {
                    return _newFn(eventName, _wrapFunction(fn));
                } else {
                    return _newFn(eventName, subElem, _wrapFunction(fn));
                }
            };
        } else if (['webpackJsonp'].indexOf(fnName) >= 0) {
            scope[fnName] = function (chunkIds, moreModules, executeModules) {
                return _newFn(chunkIds, moreModules, executeModules);
            };
        } else {
            return _wrapFunction(_newFn);
        }
    }

    /**
     * 默认处理方法使用上报错误信息，自己也可以重定义
     * 
     * @param {any} e 异常对象
     * @returns 返回是否成功上报
     */
    function _reportError(e) {
        setTimeout(function () {
            _reportServer(e.name, e.stack, window.location.href);
        }, config.delay);
    }

    /**
     * 上报错误信息到服务器，uinExtension的信息添加到uin上报
     * 
     * @param {any} type 
     * @param {any} msg 
     * @param {any} url 
     * @param {any} rowNum 
     * @param {any} colNum 
     */
    function _reportServer(type, msg, url, rowNum, colNum) {
        // 根据概率上报
        var randomIgnore = Math.random() >= config.random;
        if (randomIgnore) {
            return;
        }

        // 如果匹配到忽略的正则式，则终止上报
        for (var i = 0, length = config.ignore.length; i < length; i++) {
            if (config.ignore[i].test(msg)) {
                return;
            }
        }

        var extensionMsg = '';
        for (var key in config.uinExtension) {
            extensionMsg += '@' + key + ':' + config.uinExtension[key];
        }

        if (Math.random() < config.random) {
            var logid = 'log_' + (new Date()).getTime();
            var img = window[logid] = new Image();  //把new Image()赋给一个全局变量持有
            var uin = parseInt((document.cookie.match(/\buin=\D+(\d+)/) || [])[1], 10) + extensionMsg;

            // 上报成功或失败都清空持有的变量
            img.onload = img.onerror = function () {
                window[logid] = null;
            };

            type = encodeURIComponent(type);
            msg = encodeURIComponent(msg);
            url = encodeURIComponent(url);
            rowNum = rowNum || 0;
            colNum = colNum || 0;

            // 如果url中有?则使用&连接，否则用?连接
            var connectSymbol = config.reportUrl.indexOf('?') ? '&' : '?'

            // img.src = `${config.reportUrl}?id=${config.id}&level=${config.level}&type=${type}&msg=${msg}&from=${url}&colNum=${colNum}&rowNum=${rowNum}&uin=${uin}`
            img.src = config.reportUrl + connectSymbol + 'id=' + config.id + '&level=' + config.level + '&type=' + type + '&msg=' + msg + '&from=' + url + '&colNum=' + colNum + '&rowNum=' + rowNum + '&uin=' + uin;

            img = null;      // 释放局部变量img
        }
    }


    /**
     * 输入一个函数，将函数内代码包裹进try-catch执行，then的resolve、reject和普通函数不一样
     * 
     * @param {any} fn 
     * @returns 一个新的函数
     */
    function _wrapPromiseFunction(fn) {

        // 如果fn是个函数，则直接放到try-catch中运行，否则要将类的方法包裹起来，promise中的fn要返回null，不能返回空函数
        if (typeof fn !== 'function') {
            return null;
        }

        return function () {
            try {
                return fn.apply(this, arguments);
            } catch (e) {
                _errorProcess(e);
                throw e;
            }
        };
    }

    // var platformEvent = [EventTarget.prototype.addEventListener, EventTarget.prototype.attachEvent];
    // for (var event of platformEvent) {
    //     // 如果浏览支持addEventListener, 则拦截页面的用户鼠标操作和键盘操作
    //     if (EventTarget && event) {
    //         (function () {
    //             var _id = 1;
    //             Object.defineProperty(Object.prototype, "__oid_w__", {
    //                 writable: true
    //             });
    //             Object.defineProperty(Object.prototype, "__oid__", {
    //                 get: function () {
    //                     if (!this.__oid_w__)
    //                         this.__oid_w__ = _id++;
    //                     return this.__oid_w__;
    //                 },
    //             });
    //         })();
    
    //         var originAddEventListener = event;
    //         var map_listener = {
    //             config: {
    //                 count: true
    //             }
    //         };
    //         function new_addEventListener(type, listener, options) {
    //             return originAddEventListener.call(this, type, wrapper(this, listener, type, map_listener), options);
    //         }
    
    //         function mapid(obj, listener) {
    //             return obj.__oid__ + '_' + listener.__oid__;
    //         }
    
    //         function wrapper(target, listener, type, eventMap) {
    //             var eventid = mapid(target, listener);
    //             var event = eventMap[eventid];
    //             if (!event) {
    //                 event = {};
    //                 eventMap[eventid] = event;
    //             }
    //             event.count = 0;
    //             event.type = type;
    //             return function (evt) {
    //                 console.log(`鼠标X:${evt.clientX}`);
    //                 console.log(`鼠标Y:${evt.clientY}`);
    //                 console.log(`outerHTML:`, evt.target);
    //                 // 这里记录鼠标的操作位置和节点信息
    //                 if (event.callback) {
    //                     event.callback(evt);
    //                 }
    //                 if (eventMap.config.count) {
    //                     event.count++;
    //                 }
    //                 listener(evt);
    //             };
    //         }
    //         event = new_addEventListener;
    //     }
    // }

    /**
     * 处理全局onerror上报
     * 
     * @param {any} msg 
     * @param {any} file 
     * @param {any} row 
     * @param {any} col 
     * @param {any} errorObj 
     */
    function _onErrorHandler(msg, file, row, col, errorObj) {
        file = file || window.location.href;

        // 如果是资源加载异常
        if (msg && msg.type) {
            setTimeout(function () {
                _reportServer('Resource load ' + msg.type, 'Resource load ' + msg.type + ' @' + (msg.target && msg.target.tagName) + ': ' + (msg.target && msg.target.outerHTML), file, row, col);
            }, config.delay);
        } else {
            // js异常
            setTimeout(function () {
                _reportServer((errorObj ? JSON.stringify(errorObj) : '' || msg), msg, file, row, col);
            }, config.delay);
        }
    }

    window.Tryjs = Tryjs;
})();
