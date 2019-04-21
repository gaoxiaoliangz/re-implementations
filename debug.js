let adapter = require('./test/adapter')
const assert = require('assert')

const useNativePromise = process.argv.slice(2)[0] === '-n'

if (useNativePromise) {
  adapter = require('./test/adapter2')
}

console.log(`using ${useNativePromise ? 'native' : 'my'} promise\n`)

const deferred = adapter.deferred
const resolved = adapter.resolved
const rejected = adapter.rejected

const dummy = { dummy: 'dummy' }
const sentinel = { sentinel: 'sentinel' }
const other = { other: 'other' }

const specify = (desc, fn) => {
  const done = () => {
    console.log('done called')
  }
  console.log(desc)
  fn(done)
}
const describe = specify

const testFulfilled = function(value, test) {
  specify('already-fulfilled', function(done) {
    test(resolved(value), done)
  })

  // specify('immediately-fulfilled', function(done) {
  //   var d = deferred()
  //   test(d.promise, done)
  //   d.resolve(value)
  // })

  // specify('eventually-fulfilled', function(done) {
  //   var d = deferred()
  //   test(d.promise, done)
  //   setTimeout(function() {
  //     d.resolve(value)
  //   }, 50)
  // })
}

const testRejected = function(reason, test) {
  specify('already-rejected', function(done) {
    test(rejected(reason), done)
  })

  specify('immediately-rejected', function(done) {
    var d = deferred()
    test(d.promise, done)
    d.reject(reason)
  })

  specify('eventually-rejected', function(done) {
    var d = deferred()
    test(d.promise, done)
    setTimeout(function() {
      d.reject(reason)
    }, 50)
  })
}

// ----------------------------------------------------------------------------------

const basicUse = () => {
  const d = deferred()
  const p1 = d.promise
  setTimeout(() => {
    d.resolve(1)
  }, 100)
  const p2 = p1.then(value => {
    console.log(value)
    throw new Error('oops')
  })
  const p3 = p2.then(
    value => {
      console.log(value)
    }
    // err => {
    //   console.log(err.message, 'then catch')
    // }
  )
  const p4 = p3
    .catch(err => {
      console.log(err.message)
      return 'ok'
    })
    .then(() => {
      console.log('wtf')
    })

  // setTimeout(() => {
  //   console.log(p1)
  //   console.log(p2)
  //   console.log('p3', p3)
  //   console.log('p4', p4)
  // }, 500)
}

const testNoneFunc = () => {
  function testNonFunction(nonFunction, stringRepresentation) {
    specify('`onFulfilled` is ' + stringRepresentation, function(done) {
      rejected(dummy).then(nonFunction, function() {
        done()
      })
    })
  }

  testNonFunction(undefined, '`undefined`')
  // testNonFunction(null, '`null`')
  // testNonFunction(false, '`false`')
  // testNonFunction(5, '`5`')
  // testNonFunction({}, 'an object')
}

const testThen = () => {
  specify(
    'when one `onFulfilled` is added inside another `onFulfilled`',
    function(done) {
      var promise = resolved()
      var firstOnFulfilledFinished = false

      promise.then(function() {
        promise.then(function() {
          assert.strictEqual(firstOnFulfilledFinished, true)
          done()
        })
        firstOnFulfilledFinished = true
      })
    }
  )
}

const throwReason = () => {
  describe(
    '2.2.7.2: If either `onFulfilled` or `onRejected` throws an exception `e`, `promise2` must be rejected ' +
      'with `e` as the reason.',
    function() {
      function testReason(expectedReason, stringRepresentation) {
        describe('The reason is ' + stringRepresentation, function() {
          testFulfilled(dummy, function(promise1, done) {
            var promise2 = promise1.then(function onFulfilled() {
              throw expectedReason
            })

            promise2.then(null, function onPromise2Rejected(actualReason) {
              assert.strictEqual(actualReason, expectedReason)
              done()
            })
          })
          // testRejected(dummy, function(promise1, done) {
          //   var promise2 = promise1.then(null, function onRejected() {
          //     throw expectedReason
          //   })

          //   promise2.then(null, function onPromise2Rejected(actualReason) {
          //     assert.strictEqual(actualReason, expectedReason)
          //     done()
          //   })
          // })
        })
      }

      const reasons = {
        // undefined: () => undefined,
        'an always-pending thenable': () => ({ then: function() {} }),
      }

      Object.keys(reasons).forEach(function(stringRepresentation) {
        testReason(reasons[stringRepresentation](), stringRepresentation)
      })
    }
  )
}

// 2.3.3.1
const testThen2 = () => {
  var numberOfTimesThenRetrieved = 0
  function yFactory(value) {
    return Object.create(null, {
      then: {
        get: function() {
          if (numberOfTimesThenRetrieved === 0) {
            ++numberOfTimesThenRetrieved
            return function(onFulfilled) {
              console.log('here')
              onFulfilled(value)
            }
          }
          return null
        },
      },
    })
  }

  const yFactory2 = v => {
    return {
      then(cb) {
        cb(v)
      },
    }
  }

  const p1 = resolved(1)
  const p2 = p1.then(() => {
    return yFactory(2)
  })
  const p3 = p2.then(() => {
    console.log('done')
  })

  setTimeout(() => {
    console.log('numberOfTimesThenRetrieved', numberOfTimesThenRetrieved)
  }, 10)
}

const resolveThenable = () => {
  function xFactory() {
    return {
      then: function(resolvePromise) {
        resolvePromise(yFactory())
      },
    }
  }

  const yFactory = value => {
    return {
      then: function(onFulfilled) {
        onFulfilled(value)
      },
    }
  }

  resolved('ok')
    .then(v => {
      return yFactory(xFactory(v))
    })
    .then(v => {
      console.log(v, 'done')
    })
}

const resolveThenableStuffWithTwice = () => {
  const innerThenableFactory = v => {
    return {
      then(cb) {
        setTimeout(() => {
          cb(v)
        }, 0)
      },
    }
  }

  const outerThenableFactory = v => {
    return {
      then(cb) {
        cb(v)
        cb(v + 1)
      },
    }
  }

  function yFactory() {
    return outerThenableFactory(innerThenableFactory(sentinel))
  }

  function xFactory() {
    return {
      then: function(resolvePromise, rejectPromise) {
        resolvePromise(yFactory())
      },
    }
  }

  var promise = rejected(dummy).then(null, function onBasePromiseRejected() {
    return xFactory()
  })

  const test = (p, done, fulfillmentValue) => {
    p.then(function onPromiseFulfilled(value) {
      console.log('before')
      assert.strictEqual(value, fulfillmentValue)
      console.log('after')
      done()
    })
  }

  test(
    promise,
    () => {
      console.log('done called')
    },
    sentinel
  )
}

const resolveThenableStuff = () => {
  const outerThenableFactory = v => {
    return {
      then(cb) {
        setTimeout(() => {
          cb(v)
        }, 0)
      },
    }
  }

  const innerThenableFactory = v => {
    return rejected(v)
  }

  function yFactory() {
    return outerThenableFactory(innerThenableFactory(sentinel))
  }

  function xFactory() {
    return {
      then: function(resolvePromise, rejectPromise) {
        resolvePromise(yFactory())
      },
    }
  }

  var promise = rejected(dummy).then(null, function onBasePromiseRejected() {
    return xFactory()
  })

  const test = (p, done, fulfillmentValue) => {
    p.then(function onPromiseFulfilled(value) {
      console.log('before')
      assert.strictEqual(value, fulfillmentValue)
      console.log('after')
      done()
    })
  }

  test(
    promise,
    () => {
      console.log('done called')
    },
    sentinel
  )
}

// testThen2()
// throwReason()
// resolveThenable()
resolveThenableStuff()

// 2 piece
// var outerThenableFactory = function(value) {
//   return resolved(value)
// }

// var innerThenableFactory = function(value) {
//   return {
//     then: function(onFulfilled) {
//       onFulfilled(value)
//       throw other
//     },
//   }
// }

// function yFactory() {
//   return outerThenableFactory(innerThenableFactory(sentinel))
// }

// function isPromise(promise) {
//   // 2.3.3.1: promise 也可能是带有 then 的 function
//   return (
//     promise &&
//     (promise instanceof Object || typeof promise === 'object') &&
//     'then' in promise
//   )
// }

// console.log(isPromise(yFactory(sentinel)))

// function xFactory() {
//   return {
//     then: function(resolvePromise) {
//       resolvePromise(yFactory(sentinel))
//     },
//   }
// }

// var promise = resolved(dummy).then(function onBasePromiseFulfilled() {
//   const x = xFactory()
//   return x
// })

// promise.then(function onPromiseFulfilled(value) {
//   console.log(value)
//   console.log(numberOfTimesThenRetrieved)
// })

// // 2 简化
// var promise = resolved(dummy).then(function() {
//   return {
//     then(resolvePromise) {
//       resolvePromise(resolved({
//         then(onFulfilled) {
//           onFulfilled(sentinel);
//           throw other;
//         }
//       }))
//     }
//   };
// });

// promise.then(function onPromiseFulfilled(value) {
//   console.log(value)
// });

// // 3 then is not a function
// var promise = resolved(dummy).then(function() {
//   return {
//     then: 5
//   };
// });

// promise.then(function onPromiseFulfilled(value) {
//   console.log(value)
// });

// 4
// describe("2.3.2.1: If `x` is pending, `promise` must remain pending until `x` is fulfilled or rejected.",

// function xFactory() {
//   return deferred().promise;
// }

// var wasFulfilled = false;
// var wasRejected = false;

// resolved(dummy).then(function onBasePromiseFulfilled() {
//   return xFactory();
// }).then(
//   function onPromiseFulfilled() {
//     wasFulfilled = true;
//   },
//   function onPromiseRejected() {
//     wasRejected = true;
//   }
//   );

// setTimeout(function () {
//   console.log(wasFulfilled, wasRejected)
// }, 100);

// // 5
// describe("calling `resolvePromise` then `rejectPromise`, both synchronously", function () {
// function xFactory() {
//   return {
//     then: function (resolvePromise, rejectPromise) {
//       resolvePromise(sentinel);
//       rejectPromise(other);
//     }
//   };
// }

// resolved(dummy).then(function onBasePromiseFulfilled() {
//   return xFactory();
// }).then(function (value) {
//   console.log(value)
// });

// 6
// describe("saving and abusing `resolvePromise` and `rejectPromise`", function () {
// var savedResolvePromise, savedRejectPromise;

// function xFactory() {
//   return {
//     then: function (resolvePromise, rejectPromise) {
//       savedResolvePromise = resolvePromise;
//       savedRejectPromise = rejectPromise;
//     }
//   };
// }

// var timesFulfilled = 0;
// var timesRejected = 0;

// rejected(dummy).then(null, function onBasePromiseRejected() {
//   return xFactory();
// }).then(
//   function () {
//     ++timesFulfilled;
//   },
//   function () {
//     ++timesRejected;
//   });

// if (savedResolvePromise && savedRejectPromise) {
//   savedResolvePromise(dummy);
//   savedResolvePromise(dummy);
//   savedRejectPromise(dummy);
//   savedRejectPromise(dummy);
// }

// setTimeout(function () {
//   savedResolvePromise(dummy);
//   savedResolvePromise(dummy);
//   savedRejectPromise(dummy);
//   savedRejectPromise(dummy);
// }, 50);

// setTimeout(function () {
//   console.log(timesFulfilled, 'should be 1')
//   console.log(timesRejected, 'should be 0')
// }, 100);
