

&emsp;&emsp;目前retcode上报使用的log上报使用的是window.onerror上报，对于跨域脚本出现80%以上的错误信息是script error，这些对于开发者来说是无效的，所以需要使用try...catch可以抓取绝大多数作用域下的js运行错误堆栈信息，有利于我们发现问题，提升业务质量。

&emsp;&emsp;目标在于进一步获取onerror中的详细错误信息。以下是核心实现：

```javascript
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
```

###### 使用方法一：

&emsp;&emsp;在引入加载器后引入tryjs

```html
<script src="https://b.alicdn.com/@sys/loader/1.x/mloader.js"></script>
<script src="https://b.alicdn.com/@alife/tryjs/1.x/index.js"></script>
<script src="://domain.com/path/react.js"></script>
<script src="://domain.com/path/react-dom.js"></script>
<script>

	// 添加常用模块化错误捕获和错误处理
	Tryjs.init({
		// 定义需要使用try-catch包裹的全局函数，主要的入口函数内传入的函数内容将在try-catch的包裹下运行，不传则默认可以是['__def', 'require', 'define', 'setTimeout', 'setInterval']
		fnObject: ['__def', '__WPO','require', 'define', 'setTimeout', 'setInterval'] 
		error: function(e) {
			// 错误处理函数，即如果发现错误的方法
		}
	});

	// 或者使用defineError包裹函数运行，并返回一个新的函数

	function fn() {
		// 函数中业务内容
	}

	Tryjs.defineError(fn)();  // 将使fn函数内容被try-catch包裹运行，使用defineError(fn)();的效果与此相同
</script>
```

###### 使用方法二：

&emsp;&emsp;作为模块引入，初始化默认的：

```javascript
var tryjs = require('tryjs');
// 或者 import tryjs from 'tryjs'；
// 或者 define(['tryjs'], function(Tryjs){Tryjs.init()});

tryjs.init({});

```

##### 使用方法三：

&emsp;&emsp;对于React组件中函数进行包裹运行处理：

```javascript
class MyComponent extends React.Component {
    render() {
        return <div>render something here</div>;
    }
}

exports default defineError(MyComponent);
```

&emsp;&emsp;或者使用decorator:

```javascript

@defineError
class MyComponent extends React.Component {
    render() {
        return <div>render something here</div>;
    }
}

exports default MyComponent;
```

##### 使用方法四：

&emsp;&emsp;对于对象或单个函数中的内容包裹运行。

```javascript
function fn(){
	// 函数中业务内容
}

module.exports = defineError(fn);

// 或者

var pageMod = {
	init: function(){
		// 模块中初始化函数
	}	
}

module.exports = defindError(pageMod);

```

> 注意的是，Tryjs不能获取所有的脚本错误，但可以比较大的解决具体错误信息的内容

