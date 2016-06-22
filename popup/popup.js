var previouslySelectedElements = [];
var previouslySelectedFont = '';

window.onerror = function(e) {
	console.log(e);
}

// on popup load
window.addEventListener('load', function() {
	// check for Prototypo error
	chrome.tabs.query({ active: true }, function(tabs) {
		if (tabs.length > 0) {
			chrome.tabs.sendMessage(
				tabs[0].id,
				{
					action: 'get_error'
				},
				null,
				// response function containing data sent by content script
				function(error) {
					if (error) {
						var prototypoError = new PrototypoError(error);
						while (document.body.firstChild) {
							document.body.removeChild(document.body.firstChild);
						}
						document.body.appendChild(prototypoError.el);
					}
				}
			);
			chrome.tabs.sendMessage(
				tabs[0].id,
				{
					action: 'get_libraries'
				},
				null,
				// response function containing data sent by content script
				function(fonts) {
					if (fonts) {
						var prototypoButton = new PrototypoMagic(fonts.values);
						document.body.appendChild(prototypoButton.el);
						chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
							prototypoButton.container.classList.toggle('hidden');
							prototypoButton.active = !prototypoButton.active;
							sendResponse({
								isActive: prototypoButton.active,
								iconState: prototypoButton.active ? '-hover-active' : ''
							});
						}.bind(this));
					}
				}
			);
		}
	});

	// retrieve previously selected element
	chrome.storage.local.get('selectedElements', function(data) {
			if (data) {
				if (data.selectedElements) {
					previouslySelectedElements = data.selectedElements;
				}
			}
	});
	// retrieve previously selected font
	chrome.storage.local.get('selectedFont', function(data) {
			if (data) {
				if (data.selectedFont) {
					previouslySelectedFont = data.selectedFont;
				}
			}
	});

	// updateBadgeCount();
});

/**
* Font selector list
*/
var FontSelectorList = function() {
	var self = this;
	this.el = document.querySelector('.prototypo-font-selector-list')
	this.list = {};
	previouslySelectedElements.forEach(function(element) {
		self.addFontSelector(element.selector, element.font);
	});
};

/**
* Add a new font selector
* @param {string} selector
* @param {string} fontname
*/
FontSelectorList.prototype.addFontSelector = function(selector, fontname) {
	var item = new FontSelectorLink(selector, fontname, this);
	this.el.appendChild(item.el);

	this.list[selector] = item;

	if (Object.keys(this.list).length === 1) {
		document.querySelector('.prototypo-magic-font-list-container').classList.add('scale-in');
	}

	this.el.classList.remove('hidden');
};

/**
* Remove a font selector
* @param {string} selector
*/
FontSelectorList.prototype.remove = function(selector) {
	var item = this.list[selector];
	delete this.list[selector];
	if (Object.keys(this.list).length === 0) {
		document.querySelector('.prototypo-magic-font-list-container').classList.remove('scale-in');
		document.querySelector('.prototypo-magic-font-list-container').classList.add('scale-out');
		var endHandler = function() {
				this.el.classList.add('hidden');
				document.querySelector('.prototypo-magic-font-list-container').classList.remove('scale-out');
				this.el.removeChild(item.el);

				removeStyleTag(selector);

				document.querySelector('.prototypo-magic-font-list-container').removeEventListener('animationend', endHandler);
				sendMessageToContent('unhighlight_selection', {
					selector: selector
				});
		}.bind(this);
		document.querySelector('.prototypo-magic-font-list-container').addEventListener('animationend', endHandler);
	} else {
		item.el.classList.remove('height-in');
		item.el.classList.add('height-out');
		item.el.addEventListener('animationend', function() {
			this.el.removeChild(item.el);

			removeStyleTag(selector);

			sendMessageToContent('unhighlight_selection', {
				selector: selector
			});
		}.bind(this));
	}
}

/**
* FontSelectorLink
* @param {string} selector
* @param {string} fontname
* @param {string} parent
*/
var FontSelectorLink = function(selector, fontname, parent) {
	this.selector = selector;
	this.list = parent;

	this.el = document.createElement('li');
	this.el.classList.add('height-in');

	this.selectorContainer = document.createElement('div');
	this.selectorContainer.classList.add('prototypo-list-selector-container');

	this.selectorName = document.createElement('div');
	this.selectorName.classList.add('prototypo-list-selector-name');
	this.selectorName.innerText = selector;

	this.selectorDelete = document.createElement('div');
	this.selectorDelete.classList.add('prototypo-list-selector-delete');
	this.selectorDelete.style.backgroundImage = 'url(\'' + chrome.extension.getURL('delete.svg') + '\')';

	this.fontNameContainer = document.createElement('div');
	this.fontNameContainer.classList.add('prototypo-list-fontname-container');
	this.fontNameContainer.innerText = fontname;

	this.selectorContainer.appendChild(this.selectorName);
	this.selectorContainer.appendChild(this.selectorDelete);
	this.el.appendChild(this.selectorContainer);
	this.el.appendChild(this.fontNameContainer);

	this.el.addEventListener('mouseenter', function() {
		sendMessageToContent('highlight_selection', {
			selector: selector
		});
	});

	this.el.addEventListener('mouseleave', function() {
		sendMessageToContent('unhighlight_selection', {
			selector: selector
		});
	});

	this.selectorDelete.addEventListener('click', function(e) {
		this.list.remove(this.selector);
		removeStoredElement(this.selector);
		sendMessageToContent('unselect_all_elements');
	}.bind(this));
};

/**
* PrototypoMagic
* @param {array} fonts - fonts from Prototypo
*/
var PrototypoMagic = function(fonts) {
	this.active = false;

	this.el = document.querySelector('.prototypo-magic');

	this.listContainer = document.querySelector('.prototypo-magic-font-list-container');

	this.container = document.querySelector('.prototypo-magic-container');

	this.selectorInput = new SelectorInput();

	this.fontSelect = new FontSelect(fonts);

	this.validFont = document.querySelector('.prototypo-magic-apply');
	this.validFont.addEventListener('click', function(e) {
		if (this.selectorInput.input.value) {
			e.stopPropagation();
			this.selectorInput.input.classList.remove('in-error');
			try {
				document.querySelector(this.selectorInput.input.value);

				sendMessageToContent('apply_style', {
					selector: this.selectorInput.input.value,
					selectedFont : this.fontSelect.el.value
				});

				// update existing selector if already existing
				if (this.listFontSelector.list[this.selectorInput.input.value]) {
					this.listFontSelector.list[this.selectorInput.input.value].fontNameContainer.innerHTML = this.fontSelect.el.value;
				} else {
					this.listFontSelector.addFontSelector(this.selectorInput.input.value, this.fontSelect.el.value);
				}

				storeElement(this.selectorInput.input.value, this.fontSelect.el.value);

			} catch (error) {
				console.log(error);
				this.selectorInput.input.classList.add('in-error');
			}
			this.selectorInput.input.value = '';
		} else {
			this.selectorInput.input.classList.add('in-error');
		}
	}.bind(this));

	this.container.appendChild(this.validFont);

	this.listFontSelector = new FontSelectorList();
	this.listContainer.appendChild(this.listFontSelector.el);
}

/**
* SelectorInput
*/
var SelectorInput = function() {
	this.el = document.querySelector('.prototypo-magic-selector')

	this.input = document.querySelector('.prototypo-magic-selector-input');
	if (previouslySelectedElements.length > 0) {
		this.input.value = previouslySelectedElements[previouslySelectedElements.length - 1].selector;
	}

	this.selectionMode = document.querySelector('.prototypo-magic-selection-mode');

	this.selectionModeState = false;

	this.elementHighlighted = undefined;

	var self = this;

	this.selectionMode.addEventListener('click', selectionProcess.bind(this));

	// launch selection process
	function selectionProcess() {
			var selection = !this.selectionModeState;
			var selectedFont = document.querySelector('.prototypo-magic-select').value;

			this.selectionModeState = !this.selectionModeState;
			this.selectionMode.classList.toggle('is-active');

			// on click, send a request to the tab to start selection process
			sendMessageToContent('unselect_all_elements');
			sendMessageToContent('start_selection', {
				selection: selection,
				self: self,
				font: selectedFont
			});
			// then close the popup
			window.close(); // idealement ici faire ça en callback apres reponse du contentScript
	}

	this.elementAffected = [];

	this.input.addEventListener('keyup', function(e) {
		var selector = e.target.value;
		if (selector) {
			try {
				document.querySelectorAll(selector);
				sendMessageToContent('select_elements', {
					selector: selector
				});
			} catch (error) {
				console.log(error);
			}
		} else {
			sendMessageToContent('unselect_all_elements');
		}
	});
}

/**
* FontSelect
* @param {array} fonts - loaded fonts from Prototypo
*/
var FontSelect = function(fonts) {

	this.el = document.querySelector('.prototypo-magic-select');

	fonts.forEach(function(font) {
		font.variants.forEach(function(variant) {
			var variantOption = document.createElement('option');
			variantOption.value = variant.db;
			variantOption.innerText = font.name + ' ' + variant.name;

			this.el.appendChild(variantOption);

		}.bind(this));
	}.bind(this));

	// select previously selected font if necessary
	if (previouslySelectedFont !== '') {
		var options = document.querySelectorAll('.prototypo-magic-select option');
		Array.prototype.forEach.call(options,function(option) {
			if (option.value === previouslySelectedFont) {
				option.selected = true;
			}
		});
	}
}

/**
* PrototypoError
*/
var PrototypoError = function(message) {
	this.el = document.createElement('div');
	this.el.classList.add('prototypo-magic-error');
	this.el.innerText = message;
}

/**
* A helper function to send a message to the content script
* @param {string} action - a string representing the action to be sent
* @param {object} message - a key:value message object
*/
function sendMessageToContent(action, message) {
	if (typeof action === 'string') {
		chrome.tabs.query({ active: true }, function(tabs) {
			// send a request to the content script
			chrome.tabs.sendMessage(
				tabs[0].id,
				{
					action: action,
					message: message
				},
				null,
				function(response) {
					console.log(response);
				}
			);
		});
	} else {
		throw new Error('sendMessageToContent - action (first parameter) must be of type string');
	}
}

/**
*	Stores the selected element in chrome storage
* @param {string} selector - concerned selector stored as a string
* @param {string} font - concerned font stored as a string
*/
function storeElement(selector, font) {
	var isStored = false;
	chrome.storage.local.get('selectedElements', function(data) {
		if (data) {
			if (data.selectedElements) {
				// look up the array to see if selector is already in
				data.selectedElements.forEach(function(element) {
					if (element) {
						// if the selector was already in the array
						if(element.selector === selector) {
							isStored = true;
							element.font = font;
						}
					}
				});
				// if the selector was not present, add it
				if (!isStored) {
					data.selectedElements.push({ selector: selector, font: font });
				}
				chrome.storage.local.set({ selectedElements: data.selectedElements });
			} else {
				chrome.storage.local.set({ selectedElements: [{ selector: selector, font: font }] });
			}
		}
		updateBadgeCount();
	});
}

/**
*	Removes the selected element from chrome storage
* @param {string} selector - concerned selector stored as a string
*/
function removeStoredElement(selector) {
	var indexToRemove;
	chrome.storage.local.get('selectedElements', function(data) {
		if (data) {
			if (data.selectedElements) {
				// loop over the array to find the index we want to remove
				data.selectedElements.forEach(function(element, index) {
					if (element.selector === selector) {
						indexToRemove = index;
					}
				});
				// remove the index
				data.selectedElements.splice(indexToRemove, 1);
				// set the newly obtained table
				chrome.storage.local.set({ selectedElements: data.selectedElements });
			}
		}
		updateBadgeCount();
	});
}

/**
* Remove corresponding style tag
* @param {string} - the selector for which the tag must be removed
*/
function removeStyleTag(selector) {
	sendMessageToContent('remove_style_tag', {
		selector: selector
	});
}

/**
* Update badge count
*/
function updateBadgeCount() {
	// set the number of the current tab's badge
	chrome.storage.local.get('selectedElements', function(data) {
		if (data) {
			if (data.selectedElements) {
				chrome.tabs.query({ active: true }, function(tabs) {
					if (tabs.length > 0) {
						if (data.selectedElements.length > 0) {
							chrome.browserAction.setBadgeText({ text: (data.selectedElements.length).toString(), tabId: tabs[0].id });
						} else {
							chrome.browserAction.setBadgeText({ text: '', tabId: tabs[0].id });
						}
					}
				});
			}
		}
	});
}
