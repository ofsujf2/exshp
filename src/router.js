// src/router.js — mini router senza dipendenze esterne
'use strict';

function compile(path) {
  const paramNames = [];
  const pattern = path
    .split('/')
    .map(seg => {
      if (seg.startsWith(':')) {
        paramNames.push(seg.slice(1));
        return '([^/]+)';
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { regex: new RegExp(`^${pattern}/?$`), paramNames };
}

class Router {
  constructor() {
    this.routes = [];
  }
  add(method, path, auth, handler) {
    const { regex, paramNames } = compile(path);
    this.routes.push({ method, regex, paramNames, auth, handler });
    return this;
  }
  get(path, auth, handler) { return this.add('GET', path, auth, handler); }
  post(path, auth, handler) { return this.add('POST', path, auth, handler); }
  put(path, auth, handler) { return this.add('PUT', path, auth, handler); }
  del(path, auth, handler) { return this.add('DELETE', path, auth, handler); }

  match(method, pathname) {
    for (const r of this.routes) {
      if (r.method !== method) continue;
      const m = r.regex.exec(pathname);
      if (!m) continue;
      const params = {};
      r.paramNames.forEach((name, i) => { params[name] = decodeURIComponent(m[i + 1]); });
      return { handler: r.handler, auth: r.auth, params };
    }
    return null;
  }
}

module.exports = { Router };
