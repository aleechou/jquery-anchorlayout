
(function($){

var version = "0.1.0"

var anchorPoints = {
    "lfttop":   [ calculateTop,     calculateLeft   ]
    , "top":    [ calculateTop,     calculateMidH   ]
    , "rgttop": [ calculateTop,     calculateRight  ]
    , "lft":    [ calculateMidV,    calculateLeft   ]
    , "center": [ calculateMidV,    calculateMidH   ]
    , "rgt":    [ calculateMidV,    calculateRight  ]
    , "lftbtm": [ calculateBottom,  calculateLeft   ]
    , "btm":    [ calculateBottom,  calculateMidH   ]
    , "rgtbtm": [ calculateBottom,  calculateRight  ]
}

var dname_prefix = "anchor-layout$"
var autoUpdateRectWhenBinding = true

var log = function defaultLogger() {}
var error = function defaultErrorLogger() {
    console.error.apply(console,arguments)
}

// API ----------------------------------
var api = {
    "bounds": function(){
        var anchors = []
        api.forEach.call(this,function(anchor){
            if( anchor.target )
                anchors.push(anchor)
        })
        return anchors
    } ,

    "forEach": function(callback){
        if(!callback)
            return this
        for(var name in anchorPoints){
            callback.call(this, this.anchor(name) )
        }
    } ,

    "width": makeSizeSetterGetter("height") ,
    "height": makeSizeSetterGetter("height") ,

    "debug": function(val){
        if(val==undefined)
            return !!this.data(dname_prefix+"debug")
        else {
            this.data(dname_prefix+"debug",!!val)
            return this
        }
    } ,

    "id": function(val){
        if(val==undefined)
            return this.data(dname_prefix+"element-id")
        else {
            this.data(dname_prefix+"element-id",val)
            return this
        }
    }
}

var staticApi = {
    "logger": function(pipe, loggerFunc){
        if(typeof loggerFunc!="function")
            throw new Error("loggerFunc must be a function")
        if(pipe=="log") {
            log = loggerFunc
        }
        else if(pipe=="error") {
            error = loggerFunc
        }
    } ,
}

function makeSizeSetterGetter(way) {
    return function(val){
        if(!this.length)
            return this
        if(val==undefined) {
            return this.data(dname_prefix+"declear-"+way)
        }
        else {
            var val = parseInt(val)
            if(isNaN(val)){
                error("val is not a valid number")
            }
            else {
                this.data(dname_prefix+"declear-"+way, val)
            }
            return this
        }
    }
}

function makeApiEntrance(api, cbUnknowAction) {
    return function(action){
        if(!this.length)
            return this
        if(api[action]) {
            var args = {}
            for(var i=1;i<arguments.length;i++){
                args[i-1] = arguments[i]
            }
            args.length = arguments.length-1
            return api[action].apply(this,args)
        }

        else if(cbUnknowAction) {
            return cbUnknowAction.apply(this,arguments)
        }
    }
}

$.anchor = makeApiEntrance(staticApi, function(action){
    throw new Error("unknow action for $.anchor(): "+action)
})
$.fn.anchor = makeApiEntrance(api, function(action){
    if(isValidAnchorName(action)) {
        var position = action
        return this.data(dname_prefix+position)
    }
    throw new Error("unknow action for $.fn.anchor(): "+action)
})


Object.keys(anchorPoints).forEach(function(point){
    $.fn[point] = function(){

        if( !this.length ){
            error("unknow element: ",this.selector)
            return
        }

        var target = null
        var targetAnchor = point

        var intArgs = []
        var stringArgs = []
        for(var i=0;i<arguments.length;i++){
            if( !!parseInt(arguments[i]) ){
                intArgs.push(arguments[i])
            }
            else if( typeof arguments[i] == "string" ) {
                stringArgs.push(arguments[i])
            }
        }
        if(intArgs.length>=2) {
            var xoffset = parseInt(intArgs[0])
            var yoffset = parseInt(intArgs[1])
        }
        else if(intArgs.length==1){
            var xoffset = parseInt(intArgs[0])
            var yoffset = xoffset
        }
        else {
            var xoffset = 0
            var yoffset = 0
        }

        if(stringArgs.length>=2) {
            target = stringArgs[0]
            targetAnchor = stringArgs[1]
        }
        else if(stringArgs.length==1) {
            if( isValidAnchorName(stringArgs[0]) ){
                targetAnchor = stringArgs[0]
            }
            else {
                target = stringArgs[0]
            }
        }

        if(!target || target=="parent")
            var $target = this.parent()
        else if(target=="window")
            var $target = $(window)
        else
            var $target = $(target)

        if(!$target.length) {
            error("can not bind to unknow element: ",target)
            return
        }

        initElementAnchors($target)
        initElementAnchors(this)

        this.anchor(point).bindTo($target,targetAnchor,xoffset,yoffset)

        return this
    }
})


// -----------------------------------

function Anchor($element, position) {
    this.id = Anchor.counter ++
    this.$element = $element
    this.position = position
    this.x = 0
    this.y = 0
    this.debug = false

    // bind to target
    this.target = null
    this.xoffset = 0
    this.yoffset = 0

    // be bound with
    this._binds = {}
}
Anchor.counter = 0

Anchor.prototype.bindTo = function ($target, targetAnchor, xoffset, yoffset) {

    if(!$target.length) {
        return
    }

    // 先断开之前的绑定
    this.unbind()

    this.target = $target.anchor(targetAnchor || this.position)

    this.xoffset = xoffset || 0
    this.yoffset = yoffset || 0

    this.target._binds[ this.id ] = this

    if(autoUpdateRectWhenBinding)
        updateRect(this.$element)

    if( this.$element.anchor("debug") )
        log("binding anchor:",this,"-->",this.target)
}

Anchor.prototype.unbind = function () {

    if(this.target) {
        this.target._binds[ this.id ] = undefined
        delete this.target._binds[ this.id ]
    }

    this.target = null
    this.offset = 0
}

Anchor.prototype.locate = function () {
    if(this.target) {
        return {
            x: this.target.x + this.xoffset ,
            y: this.target.y + this.yoffset
        }
    }
}


var layoutingElementCount = 0
function initElementAnchors($ele){

    if( !$ele.length || $ele.anchor("id")!=undefined ){
        return
    }

    $ele.css("position","absolute")

    var points = $ele.queryAnchorPoints()
    for(var anchorName in points) {
        var anchor = new Anchor($ele, anchorName)
        anchor.x = points[anchorName][0]
        anchor.y = points[anchorName][1]

        $ele.data(dname_prefix+anchorName, anchor)
    }

    if($ele[0]!=window) {
        // 监听位置变化
        observer.observe($ele[0], {attributes: true, attributeFilter: ["style"] })
        // 监听尺寸变化

            layoutingElementPool.push($ele)
    }

    $ele.anchor( "id", layoutingElementCount++ )
}

$.fn.queryAnchorPoints = function () {

    var offset = this.offset() || {left:0, top:0}  // window 元素无法返回 offset()
    var width = this.outerWidth(true)
    var height = this.outerHeight(true)
    var right = offset.left+width
    var bottom = offset.top+height
    var midH = offset.left+width/2
    var midV = offset.top+height/2

    return {
        top:        [midH,          offset.top] ,
        btm:        [midH,          bottom] ,
        lft:        [offset.left,   midV] ,
        rgt:        [right,         midV] ,
        lfttop:     [offset.left,   offset.top] ,
        rgttop:     [right,         offset.top] ,
        lftbtm:     [offset.left,   bottom] ,
        rgtbtm:     [right,         bottom] ,
        center:     [midH,          midV] ,
    }
}

function isValidAnchorName(name) {
    return !!anchorPoints[name]
}

function calculateTop(anchorPoint, rect) {
    if( rect.y==null )
        rect.y = anchorPoint.y
}
function calculateMidV(anchorPoint, rect) {
    if(rect.y==null) {
        rect.y = anchorPoint.y-(rect.height/2)
    }
    else {
        rect.height = (anchorPoint.y-rect.y)*2
    }
}
function calculateBottom(anchorPoint, rect) {
    if(rect.y==null) {
        rect.y = anchorPoint.y-rect.height
    }
    else {
        rect.height = anchorPoint.y-rect.y
    }
}
function calculateLeft(anchorPoint, rect) {
    if( rect.x==null )
        rect.x = anchorPoint.x
}
function calculateMidH(anchorPoint, rect) {
    if(rect.x==null) {
        rect.x = anchorPoint.x-(rect.width/2)
    }
    else {
        rect.width = (anchorPoint.x-rect.x)*2
    }
}
function calculateRight(anchorPoint, rect) {
    if(rect.x==null) {
        rect.x = anchorPoint.x-rect.width
    }
    else {
        rect.width = anchorPoint.x-rect.x
    }
}

function updateRect($ele){

    var oldWidth = $ele.outerWidth(true)
    var oldHeight = $ele.outerHeight(true)
    var rect = {
        x: null
        , y: null
        , width: $ele.anchor("width") || oldWidth
        , height: $ele.anchor("height") || oldHeight
    }

    var isDebug = $ele.anchor("debug")
    if(isDebug)
        log("updating rect",$ele[0],rect)

    for(var anchorName in anchorPoints){
        var anchor = $ele.anchor(anchorName)
        var point = anchor.locate()
        if(!point) {
            continue
        }
        if(isDebug)
            log("  calculating rect:", point, anchor.target)
        anchorPoints[anchorName].forEach(function(func){
            func(point, rect)
        })
    }

    $ele.offset({left:rect.x||0, top:rect.y||0})
    if(oldWidth!=rect.width)
        $ele.outerWidth(rect.width)
    if(oldHeight!=rect.height)
        $ele.outerHeight(rect.height)

    if(isDebug)
        log("  =>",rect)
}


function onUpdateRect($ele){
    var newPoints = $ele.queryAnchorPoints()

    var toBeUpdatedElements = {}
    var needMove = false

    var isDebug = $ele.anchor("debug")

    for(var pointName in newPoints){

        var anchor = $ele.anchor(pointName)
        if(anchor.x==newPoints[pointName][0] && anchor.y==newPoints[pointName][1])
            continue

        if( isDebug )
            console.log("anchor point has moved:", anchor, "->", newPoints[pointName])

        // 检查该锚点是否绑定到其他元素
        if( anchor.target )
            needMove = true

        // 检查影响到的其他元素上的锚点
        for(var id in anchor._binds) {
            if( isDebug )
                console.log("  be bound with:", anchor._binds[id])
            toBeUpdatedElements[ anchor._binds[id].$element.anchor("id") ] = anchor._binds[id].$element
        }

        anchor.x = newPoints[pointName][0]
        anchor.y = newPoints[pointName][1]
    }

    if( isDebug )
        console.log("effected elements:", toBeUpdatedElements)

    for(var id in toBeUpdatedElements) {
        updateRect( toBeUpdatedElements[id] )
    }
}

var layoutingElementPool = []

var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        onUpdateRect($(mutation.target))
    })
})
setInterval(function(){
    layoutingElementPool.forEach(function($ele){
        var width = $ele.outerWidth(true)
        var height = $ele.outerHeight(true)
        var lfttop = $ele.anchor("lfttop")
        var rgtbtm = $ele.anchor("rgtbtm")

        // 检查宽度变化
        if(rgtbtm.x-lfttop.x!=width || rgtbtm.y-lfttop.y!=height) {
            updateRect($ele)
            return
        }
    })
}, 100)

$(window).resize(function(){
    onUpdateRect($(window))
})

// 初始化 dom 上的元素
$(function(){

    // width, height
    $("[width]").each(function(){
        $(this).anchor( "width", $(this).attr("width") )
    })
    $("[height]").each(function(){
        $(this).anchor( "height", $(this).attr("height") )
    })

    // 元素上的锚点定义
    for(var name in anchorPoints){
        $("["+name+"]").each(function(){
            var $this = $(this)
            var args = $this.attr(name).split(",")
            $this[name] .apply($this, args)
        })
    }
})





if(!Array.prototype.includes) {
    Array.prototype.includes = function(val){
        for(var i=0;i<this.length;i++){
            if(this[i]==val)
                return true
        }
        return false
    }
}

}) (jQuery)
