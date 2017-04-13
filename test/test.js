
// defineError(['on'], ($ && $.fn));
// demo
function a(num){

    var obj = {
        init: function() {
            
            function getName() {
                
                // var a = {};
                // console.log(a.b.M);
                function getName() {
                
                    var a = {};
                    console.log(a.b.M);
                }
                getName();
            }
            getName();
        }
    }

    obj.init();
}

b = defineError(a);
b(2);



//  打点性能测试
function perfomanceFn() {
    // 巨大的操作模块
    var a = {
        b: 1,
        c: 1   　
    };
    var arr = [1,2,3,4,5];
    var c = function(){
        return a.b + a.c;
    }

    for(var i =1; i< 100; i++){
        a.b += i;
        a.c += 2*i;

        arr.map(function(item) {
           return item * 3; 
        });

    }

    return c();
}


var T1 = +new Date(), T2,T3;
for(let i =0; i < 10000; i++){
    defineError(perfomanceFn)();
}

T2 = +new Date();
console.log(T2 - T1);

for(let i =0; i < 10000; i++){
    perfomanceFn();
}

T3 = +new Date();
console.log(T3 - T2);     // 相差40-60ms，8%左右，所以这里性能问题影响不大
