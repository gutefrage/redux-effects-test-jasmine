/* global describe, it, expect */
import {createAction} from 'redux-actions';
import {bind} from 'redux-effects';

import {expectEffect, expectEffectWithBind} from '../src/expectEffectsHelper';

const startAction = createAction('START');
const successAction = createAction('SUCCESS');
const failureAction = createAction('FAILURE');
const cleanAction = createAction('CLEAN');

describe('expectEffect', () => {
  describe('flat action trees', () => {

    const doAction = (input) => bind(
      startAction(input),
      ({value}) => successAction(value),
      (response) => bind(
        failureAction(response),
        () => cleanAction()
      )
    );

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

  describe('nested action trees', () => {

    const doAction = (input) => bind(
      bind(
        startAction(input),
        ({value}) => successAction(value),
        (response) => bind(
          failureAction(response),
          () => cleanAction()
        )
      )
    );

    it('should work with nested expections: start -> success', () => {
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

    it('should work with expectEffectWithBind: start -> success', () => {
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
});
