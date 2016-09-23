import {bind} from 'redux-effects';
import {isPlainObject, isUndefined, isString} from 'lodash/lang';
import {repeat} from 'lodash/string';

beforeEach(() => {
  jasmine.addMatchers({
    toBeOfType: (util, customEqualityTesters) => {
      return {
        compare: (actual, expected) => {
          return {
            pass: isFluxStandardAction(actual) && util.equals(actual.type, expected, customEqualityTesters)
          };
        }
      };
    },

    toEqualAction: (util, customEqualityTesters) => {
      return {
        compare: (actual, expected) => {
          const result = {};

          result.pass = util.equals(actual.type, expected.type, customEqualityTesters);
          if (!result.pass) {
            return result;
          }

          if (isComposedEffect(expected)) {
            result.pass = util.equals(actual.payload, expected.payload, customEqualityTesters);
            result.message = `Expected ${JSON.stringify(actual.payload)} to equal ${JSON.stringify(expected.payload)}`;
          } else {
            result.pass = util.equals(actual, expected, customEqualityTesters);
          }

          return result;
        }
      };
    }
  });
});

/**
 * Provides testing support for effect actions created by redux-effect's bind().
 *
 * After verifying that the given action indeed looks like an effect, an object with the given properties is returned.
 *
 * toBeOfType(name: string) - verifies that the effect's action is of a given type
 *
 * toEqual(action) - verifies that the effect's action equals a given action, using {@link toEqualAction}, i.e. if it
 * is an effect as well, only their payload is compared. In that case you might consider {@link expectEffectWithBind}.
 *
 * withAction(fn) - runs the given fn with the effect's action as only argument to allow for more thorough checks.
 *
 * toSuccess(value) - calls the effect's success callback with the given value.
 *
 * toFailure(value) - calls the effect's failure callback with the given value
 *
 * @param effect - the composed effect to expect on
 */
export const expectEffect = (effect) => {
  expect(effect).toBeOfType('EFFECT_COMPOSE');

  const result = {
    toSuccess: getSingletonStep(effect, 0),
    toFailure: getSingletonStep(effect, 1)
  };
  result.withAction = (fn) => {
    fn(effect.payload);
    return result;
  };
  result.toEqual = (expected) => {
    return result.withAction((action) => {
      expect(action).toEqualAction(expected);
    });
  };
  result.toBeOfType = (expected) => {
    return result.withAction((action) => {
      expect(action).toBeOfType(expected);
    });
  };

  return result;
};

/**
 * Similar to {@link expectEffect}, but calls {@link unbindEffectPayload} on the effect first.
 *
 * This is just sugar to keep tests short. The function is needed instead of expectEffect, if the payload of the
 * given effect is a composed effect itself, so you would otherwise need to test the effect payload within .withAction,
 * typically leading to deeply nested tests.
 *
 * @param effect - the composed effect to expect on
 */
export const expectEffectWithBind = (effect) => expectEffect(unbindEffectPayload(effect));

const getSteps = (effect) => effect.meta && effect.meta.steps && effect.meta.steps[0];

const getSingletonStep = (effect, index) => {
  const steps = getSteps(effect);
  return steps && steps[index];
};

const isComposedEffect = (action) => {
  return isFluxStandardAction(action) && action.type === 'EFFECT_COMPOSE';
};

const isFluxStandardAction = (action) => {
  const validKeys = ['type', 'payload', 'error', 'meta'];
  const isValidKey = (key) => validKeys.indexOf(key) > -1;
  return isPlainObject(action) && !isUndefined(action.type) && Object.keys(action).every(isValidKey);
};

/**
 * Converts a composed effect with an effect as payload to one with a plain action as payload.
 *
 * Effects with plain payload are returned as is.
 *
 * This should ease testing, as one does not need to care about the actual binding tree anymore,
 * but simply adds unbind=true to expectEffect to make it work.
 *
 * All bindings are moved into the upper-most success and failure cases to get rid of bind.
 * Basically, the following transformation is repeated until the payload is no effect anymore.
 *
 * <pre>
 * bind ( bind(X, XS, XF),           bind ( X,
 *        YS,                 ===>          bind(XS, YS, YF),
 *        YF )                              bind(XF, YS, YF) )
 * </pre>
 *
 * @param effect - the composed effect
 */
export const unbindEffectPayload = (effect) => {
  expect(effect).toBeOfType('EFFECT_COMPOSE');

  if (isComposedEffect(effect.payload)) {
    const [firstSuccess, firstFailure] = getSteps(effect.payload);
    const secondSteps = getSteps(effect);
    const bindToSecondSteps = (callback) => {
      if (callback) {
        return (...args) => {
          const value = callback(...args);
          return value ? bind(value, ...secondSteps) : secondSteps[0]();
        };
      } else {
        return callback;
      }
    };

    return unbindEffectPayload(
      bind(
        effect.payload.payload,
        bindToSecondSteps(firstSuccess),
        bindToSecondSteps(firstFailure)
      )
    );
  } else {
    return effect;
  }
};

/**
 * Default value to pass to callbacks when calling them to traverse a tree of bound actions.
 */
const defaultCallbackValue = {value: {}};

/**
 * Converts an effect to a tree of action meta data by applying all callbacks along the way.
 */
const effectToActionTree = (effect, callbackValue = defaultCallbackValue) => {
  if (isComposedEffect(effect)) {
    const [successFunc, failureFunc] = getSteps(effect);
    return {
      action: effectToActionTree(effect.payload),
      success: successFunc && effectToActionTree(successFunc(callbackValue)),
      failure: failureFunc && effectToActionTree(failureFunc(callbackValue))
    };
  } else {
    return effect && effect.type;
  }
};

/**
 * Logs an effect to the console for debugging purposes. All callbacks along the way are called with callbackValue.
 */
export const logEffect = (effect, callbackValue = defaultCallbackValue) => {
  const formatActionTree = (tree, offset) => {
    if (isString(tree)) {
      return tree;
    } else if (isUndefined(tree)) {
      return '?';
    } else {
      const prefix = repeat(' ', offset);
      const nextOffset = offset + 5;
      const action = formatActionTree(tree.action, nextOffset);
      const success = `,\n${prefix}   ✔️ ${tree.success ? formatActionTree(tree.success, nextOffset) : '?'}` ;
      const failure = tree.failure ? `,\n${prefix}   ❌ ${formatActionTree(tree.failure, nextOffset)}` : '';
      return `bind(${action}${success}${failure}\n${prefix})`;
    }
  };

  const tree = effectToActionTree(effect, callbackValue);
  const formatted = formatActionTree(tree, 0);
  // eslint-disable-next-line no-console
  console.log(`\n${formatted}\n`);
};
