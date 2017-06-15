import React from 'react';
import reporter from './reporter';
import isPlainObject from 'lodash.isplainobject';

const fixedFuncMap = new Map();
class ReactCatcher {
    constructor() {
        this._elError = null;
        this._errCallback = null;
        this.init();
    }

    set(config = {}) {
        this._elError = config.elError || null;
    }

    init() {
        const originalCreateElement = React.createElement;
        React.createElement = (Component, props, ...children) => {
            if (children && children.length) {
                children = this.normalizeChildren(...children);
            }

            // Component必定是function/class或者string，性能考虑不再判断Component类型
            if (Component.prototype) {
                if (Component.prototype.render) {
                    this.fixRender(Component);
                } else {
                    Component = this.fixFunction(Component);
                }
            }
            return originalCreateElement.call(React, Component, props, ...children);
        };
    }

    fixRender(Component) {
        if (Component.__handled) {
            return;
        }

        const prototype = Component.prototype;
        const originalRender = prototype.render;
        const elError = this._elError;
        prototype.render = function() {
            try {
                return originalRender.call(this);
            } catch (e) {
                reporter.report(e, Component.name);
                return elError || null;
            }
        };
        Component.__handled = true;
    }

    fixFunction(Component) {
        const fixedFunc = fixedFuncMap.get(Component);
        if (fixedFunc) {
            return fixedFunc;
        }

        const originalComponent = Component;
        Component = (...args) => {
            try {
                return originalComponent(...args);
            } catch (e) {
                reporter.report(e, Component.name || String(Component));
                return this._elError || null;
            }
        };
        // copy properties like propTypes, defaultProps etc.
        Object.assign(Component, originalComponent);
        fixedFuncMap.set(originalComponent, Component);

        return Component;
    }
    // catch "Objects are not valid as a React child" error
    normalizeChildren(...children) {
        return children.map((item) => {
            if (!item) {
                return item;
            }
            if (React.isValidElement(item)) {
                return item;
            }
            if (!isPlainObject(item)) {
                return item;
            }
            reporter.report(`[Objects are not valid as a React child]: ${JSON.stringify(item)}`);
            return null;
        });
    }
}

const reactCatcher = new ReactCatcher();

export default reactCatcher;