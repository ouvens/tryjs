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
        root['Tryjs'] = factory();
    }
})(window, function() {

    var _errorProcess = _reportError;
    var __WPO;
    var Tryjs = Tryjs || {
        defineError: defineError,
        report: _reportError,
        init: function(options) {

            // 融合全局方法定义
            var defaultFnArray = ['__def', '__WPO', 'require', 'define', 'setTimeout', 'setInterval'],
                fnObject = options && options.fnObject || [];

            for(var i = 0; fnObject.length && i < fnObject.length && defaultFnArray.indexOf(fnObject[i]) < 0; i++){

                defaultFnArray.push(fnObject[i]);
            }
            
            _errorProcess = options && options.error || _reportError;
            // 定义初始化函数方法
            defineError(defaultFnArray, window);
        }
    };
    /**
     * 注入错误入口封装，定义哪些注入方法可以被try...catch
     * @param  {[type]} fnObject [函数方法数组或单个函数方法名称;当为函数方法名时，执行返回内容带try...catch的函数]
     * @param  {[type]} scope   [当前的作用域this]
     * @return {[type]}         [返回函数]
     */

    function defineError(fnObject, scope) {

        var noop = function() {};

        var type = Object.prototype.toString.call(fnObject).slice(8, -1).toLowerCase();
        
        if (type === 'array') {
            for (var i = 0, length = fnObject.length; i < length; i++) {
                fnObject[i] && _wrapFunctionArray(fnObject[i], scope);
            }
            return true;
        } else if (type === 'string') {
            return _wrapFunction(scope[fnObject]);
        } else if (type === 'object') {
            //  对于对象，则包裹它的方法属性，主要针对react的方法实现，需要重新定义原有方法
            for (var key in fnObject){
                if(typeof(fnObject[key]) === 'function'){
                    fnObject[key] = _wrapFunction(fnObject, scope || fnObject);
                }
            }
            return fnObject;
        } else if (type === 'function' && fnObject.prototype.isReactComponent) {
            // 可能是真正的函数或者是class, ES6的class type也是function，如果含有
            return _defineReact(fnObject);
        } else if(type === 'function'){
            // 可能是真正的函数或者是class, ES6的class type也是function
            return _wrapFunction(fnObject, scope || fnObject);
        } else {
            return noop;
        }
    }

    /**
     * 封装React方法的错误处理,改成使用入参的prototype中是否有render生命周期函数来判断
     * @param  {[type]} Component [description]
     * @return {[type]}           [description]
     */
    function _defineReact(Component){

        var proto = Component.prototype;

        for(var key in proto){
            if(typeof(proto[key]) === 'function'){
                proto[key] = _wrapFunction(proto[key]);
            }
        }

        return Component;
    }

    // 包裹单个函数作用域，将原有函数封装，形成带有try...catch包裹的函数,ES5写法
    function _wrapFunction(fn, scope) {
        // 如果fn是个函数，则直接放到try-catch中运行，否则要将类的方法包裹起来

        if(!fn){
            return function(){};
        }
    
        return function(){
            var self = this;
            try {
                return fn.apply(this, arguments);
            } catch(e) {
                _errorProcess(e);
                return ;
            }
        }
    }

    /**
     * 判断是否为真实的函数，而不是class
     * @param  {Function} fn [description]
     * @return {Boolean}     [description]
     */
    function _isTrueFunction(fn) {

        var isTrueFunction = false;

        try{
            isTrueFunction = fn.prototype.constructor.arguments === null;
        }catch(e){
            isTrueFunction = false;
        }

        for(var key in fn.prototype){
            return isTrueFunction = false;
        }

        return isTrueFunction;
    }

    // 包裹scope作用域下的属性函数，对通用入口函数内容包裹后运行
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
    // window.onerror = function(msg, file, row, column, errorObj) {
    //     console.log(msg); // script error.
    //     console.log(file); // 
    //     console.log(row); // 0
    //     console.log(column); // 0
    //     console.log(errorObj); // {}
    //     // setTimeout(function() {
    //     //     __WPO && __WPO.error(e.name, e.message + e.stack);
    //     // }, 5000);
    // }
    
    window.defineError = defineError;
    window.defineReact = _defineReact;
    window.Tryjs = Tryjs;
    return Tryjs;
});