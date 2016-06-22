// set the badge background color
chrome.browserAction.setBadgeBackgroundColor({ color: "#23d390" });

// listening to messages
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	switch (request.action) {
		// update badge count
		case "store_element":
			storeElement(request.message.selector, request.message.font);
			updateBadgeCount(sender.tab.id);
			break;
		case "store_selected_font":
			storeSelectedFont(request.message.selectedFont);
			break;
		default:
			sendResponse("default response from background (unrecognized request action)");
	}
});


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
	});
}

/**
*	Stores the selected font in chrome storage
* @param {string} selectedFont - concerned font stored as a string
*/
function storeSelectedFont(selectedFont) {
	chrome.storage.local.set({selectedFont: selectedFont});
}

/**
* Update badge count
*/
function updateBadgeCount(tabId) {
	// set the number of the current tab's badge
	chrome.storage.local.get('selectedElements', function(data) {
		if (data) {
			if (data.selectedElements) {
				if (data.selectedElements.length > 0) {
					chrome.browserAction.setBadgeText({ text: (data.selectedElements.length).toString(), tabId: tabId });
				} else {
					chrome.browserAction.setBadgeText({ text: '', tabId: tabId });
				}
			}
		}
	});
}
