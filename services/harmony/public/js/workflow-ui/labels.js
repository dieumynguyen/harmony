/* eslint-disable no-continue */
import jobsTable from './jobs/jobs-table.js';
import toasts from './toasts.js';
import PubSub from '../pub-sub.js';

const labelLinks = document.querySelectorAll('#labels-list .label-li a');
const labelDropdown = document.getElementById('label-dropdown-a');
const bsDropdown = new bootstrap.Dropdown(labelDropdown);

/**
 * Responds to a submit link click event
 * (hits relevant Harmony url, shows user the response).
 * @param {Event} event - the click event
 */
async function handleSubmitClick(event, method) {
  bsDropdown.hide();
  event.preventDefault();
  const labelName = event.target.getAttribute('data-value');
  const jobIds = jobsTable.getJobIds();
  const postfix = jobIds.length === 1 ? '' : 's';
  let action = method === 'PUT' ? 'Adding' : 'Removing';
  toasts.showUpper(`${action} label...`);
  const res = await fetch('/labels', {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ jobId: jobIds, label: [labelName] }),
  });
  action = method === 'PUT' ? 'Added' : 'Removed';
  if (res.status === 201 || res.status === 204) {
    toasts.showUpper(`${action} "${labelName}" label for ${jobIds.length} job${postfix}.`);
    PubSub.publish(
      'row-state-change',
    );
  } else {
    toasts.showUpper('The update failed.');
  }
}

/**
 *
 */
function selectLabels(labelNames) {
  const labelNamesReversed = labelNames.reverse();
  const labelsListElement = document.getElementById('labels-list');
  for (const name of labelNamesReversed) {
    const labelElement = labelsListElement.querySelector(`a[name="${name}"]`).parentNode;
    const labelElementClone = labelElement.cloneNode(true);
    labelElementClone.setAttribute('title', `remove "${labelElementClone.innerText}" label from all selected jobs`);
    labelElementClone.classList.add('label-clone');
    labelElementClone.addEventListener('click', (event) => {
      handleSubmitClick(event, 'DELETE');
    }, false);
    const labelCloneAnchor = labelElementClone.firstChild;
    labelCloneAnchor.innerText = `✔️ ${labelCloneAnchor.innerText}`;
    document.getElementById('labels-list').prepend(labelElementClone);
    labelElement.style.display = 'none';
    labelElement.classList.add('label-promoted');
  }
}

/**
 *
 */
function deselectAllLabels() {
  const clonedLabels = document.getElementsByClassName('label-clone');
  while (clonedLabels[0]) {
    clonedLabels[0].parentNode.removeChild(clonedLabels[0]);
  }
  [].slice.call(document.getElementsByClassName('label-promoted'))
    .forEach((el) => el.classList.remove('label-promoted'));
}

/**
 *
 */
function filterLabelsList() {
  const searchValue = document.querySelector('#label-search').value.toLowerCase().trim();
  const labelItems = document.querySelectorAll('#labels-list .label-li');
  let visibleCount = 0;
  for (const labelItem of labelItems) {
    if (labelItem.classList.contains('label-promoted')) { // skip, stays hidden
      continue;
    }
    const labelName = labelItem.firstChild.getAttribute('data-value').toLowerCase().trim();
    const isMatch = labelName.startsWith(searchValue);
    labelItem.style.display = isMatch ? '' : 'none';
    if (isMatch) visibleCount += 1;
  }
  document.getElementById('no-match-li').style.display = visibleCount === 0 ? '' : 'none';
}

/**
 *
 */
function showAllLabels() {
  const labelItems = document.querySelectorAll('#labels-list .label-li');
  for (const labelItem of labelItems) {
    labelItem.style.display = '';
  }
}

/**
 * Get the intersection of jobs' labels so that we know which labels
 * will be marked for potential deletion in the dropdown.
 */
function getLabelsForSelectedJobs() {
  let labelsSet = new Set();
  let firstChecked = true;
  document.querySelectorAll('.select-job').forEach((jobEl) => {
    if (jobEl.checked) {
      const jobID = jobEl.getAttribute('data-id');
      const labelsString = document.querySelector(`#job-labels-display-${jobID}`).getAttribute('data-labels');
      const currentSet = new Set();
      const labels = labelsString === '' ? [] : labelsString.split(',');
      labels.forEach((item) => currentSet.add(item));
      if (firstChecked) { // init labelsSet
        labels.forEach((item) => labelsSet.add(item));
        firstChecked = false;
      } else {
        labelsSet = labelsSet.intersection(currentSet);
      }
    }
  });
  console.log(Array.from(labelsSet));
  return Array.from(labelsSet);
}

/**
 *
 */
function setLabelLinksDisabled(selectedJobsCount) {
  if (selectedJobsCount === 0) {
    for (const labelItemLink of labelLinks) {
      labelItemLink.classList.add('disabled');
    }
  }
}

/**
 *
 */
function setLabelLinksEnabled() {
  for (const labelItemLink of labelLinks) {
      labelItemLink.classList.remove('disabled');
  }
}

/**
 *
 */
function bindEventListeners() {
  const labelSearchElement = document.getElementById('label-search');
  labelSearchElement.addEventListener('keyup', () => {
    filterLabelsList();
  });
  document.querySelectorAll('.label-item').forEach((item) => {
    item.addEventListener('click', (event) => {
      handleSubmitClick(event, 'PUT');
    }, false);
  });
  labelDropdown.addEventListener('hidden.bs.dropdown', () => {
    deselectAllLabels();
    setLabelLinksEnabled();
    document.getElementById('label-search').value = '';
    showAllLabels();
    document.getElementById('no-match-li').style.display = 'none';
  });
  labelDropdown.addEventListener('show.bs.dropdown', () => {
    selectLabels(getLabelsForSelectedJobs());
    const selectedJobsCount = jobsTable.getJobIds().length;
    setLabelLinksDisabled(selectedJobsCount);
  });
}

/**
 *
 */
export default {

  /**
   *
   */
  init() {
    bindEventListeners();
  },
};
