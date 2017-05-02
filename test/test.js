
// 普通初始化方法封装
Tryjs.init({
    fnObject: ['__def', '__WPO', 'require', 'define', 'setTimeout', 'setInterval'],
    error: function() {
        // 错误后的处理方法
    }
});


// 对对象的封装
var A = {
    init: function(){
        var a = {};
        console.log(a.b.c);
    }
};

defineError(A);

A.init();

// 对普通函数的包裹封装
function fn() {
    var a = {};
    console.log(a.b.c);
}

defineError(fn)();

// 对React模块的包裹封装
class MyComponent extends React.Component {
    render() {
        return <div>render something here</div>;
    }
}

exports default defineError(MyComponent);