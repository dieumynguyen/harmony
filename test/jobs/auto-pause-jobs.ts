/* eslint-disable no-loop-func */
import { expect } from 'chai';
import _ from 'lodash';
import { WorkItemStatus } from '../../app/models/work-item-interface';
import db from '../../app/util/db';
import env from '../../app/util/env';
import { truncateAll } from '../helpers/db';
import { hookRedirect } from '../helpers/hooks';
import { hookRangesetRequest } from '../helpers/ogc-api-coverages';
import hookServersStartStop from '../helpers/servers';
import { getWorkForService, updateWorkItem } from '../helpers/work-items';

const originalPreviewThreshold = env.previewThreshold;

// unit tests for auto-pausing/resuming jobs

/**
 * Define common tests to be run for auto-pause
 * 
 * @param username - user to use when calling Harmony
 * @param status - expected job status
 * @param message - expected job status message
 */
function autoPauseCommonTests(username: string, status: string, message: string): void {
  describe('retrieving its job status', function () {
    hookRedirect(username);

    it('returns a correct status field', function () {
      const job = JSON.parse(this.res.text);
      expect(job.status).to.eql(status);
    });

    it('returns a human-readable message field corresponding to its state', function () {
      const job = JSON.parse(this.res.text);
      expect(job.message).to.include(message);
    });

    it('does not supply a link to the STAC catalog', function () {
      const job = JSON.parse(this.res.text);
      expect(job.stac).to.be.undefined;
    });
  });
}

/**
 * Define test that job status moves from 'previewing' to 'paused' when the first granule completes
 *
 */
function previewingToPauseTest(): void {
  describe('and a granule has completed processing', async function () {
    before(async function () {
      const resQueryCmr = await getWorkForService(this.backend, 'harmonyservices/query-cmr:latest');
      expect(resQueryCmr.status).to.equal(200);
      const workItemQueryCmr = JSON.parse(resQueryCmr.text).workItem;
      workItemQueryCmr.status = WorkItemStatus.SUCCESSFUL;
      workItemQueryCmr.results = [
        'test/resources/worker-response-sample/catalog0.json',
      ];
      await updateWorkItem(this.backend, workItemQueryCmr);

      const resServExample = await getWorkForService(this.backend, 'harmonyservices/service-example:latest');
      expect(resServExample.status).to.equal(200);
      const workItemServExample = JSON.parse(resServExample.text).workItem;
      workItemServExample.status = WorkItemStatus.SUCCESSFUL;
      workItemServExample.results = [
        'test/resources/worker-response-sample/catalog0.json',
      ];
      await updateWorkItem(this.backend, workItemServExample);
    });

    after(async function () {
      await db('work_items').truncate();
    });

    autoPauseCommonTests('jdoe1', 'paused', 'The job is paused');
  });
}

describe('Auto-pausing jobs', function () {
  hookServersStartStop({ skipEarthdataLogin: false });
  before(async function () {
    env.previewThreshold = 3;
  });
  after(function () {
    env.previewThreshold = originalPreviewThreshold;
  });
  describe('When a request a request is made', function () {
    const collection = 'C1233800302-EEDTEST';
    const variableName = 'red_var';
    const version = '1.0.0';
    describe('when the request has more than PREVIEW_THRESHOLD input granules', function () {

      describe('and skipPreview is not set', function () {
        describe('and maxResults is set', function () {
          hookRangesetRequest(version, collection, variableName, { username: 'jdoe', query: { maxResults: env.previewThreshold + 1 } });

          autoPauseCommonTests('jdoe', 'previewing', 'The job is generating a preview before auto-pausing');

          previewingToPauseTest();
        });


        describe('and maxResults is not set', function () {
          hookRangesetRequest(version, collection, variableName, { username: 'jdoe' });

          autoPauseCommonTests('jdoe', 'previewing', 'The job is generating a preview before auto-pausing');

          previewingToPauseTest();

        });
      });

      describe('and skipPreview is set', function () {
        hookRangesetRequest(version, collection, variableName, { username: 'jdoe', query: { skipPreview: true } });

        autoPauseCommonTests('jdoe', 'running', 'The job is being processed');
      });
    });
  });
});