/**
 * 为兼容ES5，使用旧的模块化规范定义。
 * author: chengwen.zcw
 * descrption: 获取JS运行错误的具体信息
 */

(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define([], factory());
    } else if (typeof exports === 'object') {
        // CommonJS之类的
        module.exports = factory();
    } else {
        // 浏览器全局变量(root 即 window)
        root['Try'] = factory();
    }
})(window, function() {

    var _errorProcess = _reportError;
    var __WPO;
    var Try = Try || {
        defineError: defineError,
        report: _reportError,
        init: function(options) {

            // 融合全局方法定义
            var defaultFnArray = ['__def', '__WPO', 'require', 'define', 'setTimeout', 'setInterval'],
                fnArray = options && options.fnArray || [];

            for(var i = 0; fnArray.length && i < fnArray.length && defaultFnArray.indexOf(fnArray[i]) < 0; i++){

                defaultFnArray.push(fnArray[i]);
            }
            
            _errorProcess = options && options.error || _reportError;
            // 定义初始化函数方法
            defineError(defaultFnArray, window);
        }
    };
    /**
     * 注入错误入口封装，定义哪些注入方法可以被try...catch
     * @param  {[type]} fnArray [函数方法数组或单个函数方法名称;当为函数方法名时，执行返回内容带try...catch的函数]
     * @param  {[type]} scope   [当前的作用域this]
     * @return {[type]}         [返回函数]
     */

    function defineError(fnArray, scope) {

        var noop = function() {};
        scope = scope || window;

        if (Object.prototype.toString.call(fnArray).slice(8, -1).toLowerCase() === 'array') {
            for (var i = 0, length = fnArray.length; i < length; i++) {
                _wrapFunctionArray(fnArray[i], scope);
            }
            return true;
        } else if (typeof(fnArray) === 'string') {

            return _wrapFunction(scope[fnArray]);

        } else if (typeof(fnArray) === 'function') {
            return _wrapFunction(fnArray);
        } else {
            return noop;
        }
    }

    // 包裹单个函数作用域，将原有函数封装，形成带有try...catch包裹的函数,ES5写法
    function _wrapFunction(fn) {
        // ES6 的语法
        return function() {
            try {
                return fn.apply(this, arguments); // 将函数参数用 try...catch 包裹 
            } catch (e) {
                _errorProcess(e);
            }
        }
    }

    // 包裹scope作用域下的属性函数
    function _wrapFunctionArray(fnName, scope) {

        var _newFn = _wrapFunction(scope[fnName]) || function() {};

        if (typeof(scope[fnName]) !== 'function') {
            return function(){ };
        }

        if (['__def', 'require', 'define'].indexOf(fnName) >= 0) {

            scope[fnName] = function(id, deps, factory) {

                if (typeof(factory) !== 'function' || !factory) {
                    return _newFn(id, deps);
                } else {
                    return _newFn(id, deps, _wrapFunction(factory));
                }
            };
        } else if (['setInterval', 'setTimeout'].indexOf(fnName) >= 0) {
            scope[fnName] = function(fn, time) {
                // ES6 的语法
                return _newFn(_wrapFunction(fn), time);
            };
        } else if (['on'].indexOf(fnName) >= 0) {
            scope[fnName] = function(eventName, subElem, fn) {
                if (typeof(fn) !== 'function' || !fn) {
                    return _newFn(eventName, _wrapFunction(fn));
                } else {
                    return _newFn(eventName, subElem, _wrapFunction(fn));
                }
            };
        } else {
            return _wrapFunction(_newFn);
        }
    }

    // 默认处理方法使用__WPO上报错误信息，自己也可以重定义
    function _reportError(e, opt) {
        opt = {};

        console.log('错误类型' + e.name);
        console.log('错误信息' + e.message);
        console.log('错误堆栈' + e.stack);

        if(__WPO && __WPO.error){
            setTimeout(function() {
                __WPO.error(e.name, e.message + e.stack);
            }, 5000);
        }
    }

    // error的错误上报
    // window.onerror = function(msg, file, line, row, errorObj) {
    //     console.log(msg); // script error.
    //     console.log(file); // 
    //     console.log(row); // 0
    //     console.log(column); // 0
    //     console.log(errorObj); // {}
    //     setTimeout(function() {
    //         __WPO && __WPO.error(e.name, e.message + e.stack);
    //     }, 5000);
    // }；
    
    window.defineError = defineError;
    window.Try = Try;
    return Try;
});