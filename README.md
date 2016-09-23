[![Build Status](https://travis-ci.org/team-boris/redux-effects-test-jasmine.svg?branch=master)](https://travis-ci.org/team-boris/redux-effects-test-jasmine)

# redux-effects-test-jasmine

Helper methods to test redux-effect actions with jasmine.

## Installation

```
npm install redux-effects-test-jasmine
```

## Usage

With the `bind` utility method provide by [redux-effects][] we can structure action trees in two different ways.

1. The first paramater of `bind` is a plain action ( no composed effect itself ). We will call these trees _flat_
2. The first parameter of `bind` is a composed effect. We will call these trees _nested_.

The terminology comes from the way the test code looks like.

### Testing flat action trees

First we define a few actions and a simple flow. Imagine we trigger something with a `startAction` and handle the
success and failure case. On failure we will trigger `cleanAction`.

```js
import {bind} from 'redux-effects';
import {createAction} from 'redux-actions';

// a set of actions
const startAction = createAction('START');
const successAction = createAction('SUCCESS');
const failureAction = createAction('FAILURE');
const cleanAction = createAction('CLEAN');

// flat action tree. Everything is written out explicitly to get a better idea.
export const doAction = (input) => bind(
  startAction(input),
  ({value}) => successAction(value),
  (response) => bind(
    failureAction(response),
    () => cleanAction()
  )
);
```

We want to test both flows and check if all actions are triggered properly.

```js
/* global describe, it, expect */
import {expectEffect} from 'redux-effects-test-jasmine';

describe('a flat action', () => {
  it('should trigger: start -> success', () => {
    const start = doAction({id: 1});
    const successAction = expectEffect(start).withAction(action => {
      // check the action type
      expect(action).toBeOfType('START');

      // check the action content
      expect(action.payload).toEqual({id: 1});
    })
    // trigger the success case
    .toSuccess({value: 'data'});

    expect(successAction).toBeOfType('SUCCESS');
    expect(successAction.payload).toEqual('data');
  });

  it('should trigger: start -> failure -> clean', () => {
    const start = doAction({id: 2});
    const failureAction = expectEffect(start).withAction(action => {
      // check the action type
      expect(action).toBeOfType('START');

      // check the action content
      expect(action.payload).toEqual({id: 2});
    })
    // trigger the failure case
    .toFailure({value: 'error', statusCode: 500});

    const cleanAction = expectEffect(failureAction).withAction(action => {
      expect(action).toBeOfType('FAILURE');
      expect(action.payload).toEqual({value: 'error', statusCode: 500});
    }).toSuccess();

    expect(cleanAction).toBeOfType('CLEAN');
  });
});
```

### Testing nested action trees

We use the same actions as defined in the previous example, but will define a new `doAction`.

```js
// nested action tree. The first parameter is a composed effect
export const doAction = (input) => bind(
  bind(
    startAction(input),
    ({value}) => successAction(value),
    (response) => bind(
      failureAction(response),
      () => cleanAction()
    )
  )
);
```

The naive way of testing looks like this:

```js
/* global describe, it, expect */
import {expectEffect} from 'redux-effects-test-jasmine';

describe('a nested action', () => {
  it('should trigger: start -> success', () => {
    const start = doAction({id: 1});

    // nest expections
    expectEffect(start).withAction(startActionEffect => {
      // extract successAction
      const successAction = expectEffect(startActionEffect).withAction(startAction => {
        // check the action type
        expect(startAction).toBeOfType('START');
        // check the action content
        expect(startAction.payload).toEqual({id: 1});
      })
      // trigger the success case
      .toSuccess({value: 'data'});

      expect(successAction).toBeOfType('SUCCESS');
      expect(successAction.payload).toEqual('data');
    });
  });
});
```

As you can see we need to nest the expectations, which can get messy. The `expectEffectWithBind` solves this problem
by "flattening" the action tree. The algorithm basically works like this:

```
bind ( bind(X, XS, XF),           bind ( X,
       YS,                 ===>          bind(XS, YS, YF),
       YF )  
```

With this we can rewrite our test.

```js
describe('a nested action', () => {
  it('should trigger: start -> success', () => {
    const start = doAction({id: 1});

    // effect with bind flattens the action tree
    const successAction = expectEffectWithBind(start).withAction(action => {
      // check the action type
      expect(action).toBeOfType('START');

      // check the action content
      expect(action.payload).toEqual({id: 1});
    })
    // trigger the success case
    .toSuccess({value: 'data'});

    // due to flattening the action tree the successAction is also a composed effect
    expectEffect(successAction).withAction(action => {
      expect(action).toBeOfType('SUCCESS');
      expect(action.payload).toEqual('data');
    });
  });
});
```

### Log action trees

You can inspect action trees during testing with the `logEffect` utility method.

```js
import {logEffect} from 'redux-effects-test-jasmine';

logEffect(actionToLog);

// if action needs some input value to trigger sub sequent actions
logEffect(actionToLog, () => {data: {}});
```

## Build

To build the library

```
npm run build
```

## Release

```
npm version [patch|minor|major]
npm publish
git push
git push --tags
```

[redux-effects]: https://github.com/redux-effects/redux-effects
