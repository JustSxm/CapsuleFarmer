import chalk from "chalk";
import { Browser, Builder, By, until } from "selenium-webdriver";
import { Options } from "selenium-webdriver/chrome.js";
import config from "./config.json" assert { type: "json" };

const overrides = {
	"https://lolesports.com/live/worlds/riotgames": "https://lolesports.com/live/worlds",
};

let matches = [];

let builder = await new Builder().forBrowser(Browser.CHROME);

if (config.headless) {
	builder = builder.setChromeOptions(
		new Options()
			.headless()
			.windowSize({ width: 1920, height: 1080 })
			.excludeSwitches("enable-logging")
	);
} else {
	builder = builder.setChromeOptions(
		new Options().windowSize({ width: 1920, height: 1080 }).excludeSwitches("enable-logging")
	);
}
let driver = builder.build();

async function outputToConsole(msg, color) {
	let time = new Date().toLocaleTimeString();
	switch (color) {
		case "red":
			console.log(chalk.gray("[" + time + "] ") + chalk.yellow("[BRO$KY] » ") + chalk.red(msg));
			break;
		case "green":
			console.log(chalk.gray("[" + time + "] ") + chalk.yellow("[BRO$KY] » ") + chalk.green(msg));
			break;
		case "yellow":
			console.log(chalk.gray("[" + time + "] ") + chalk.yellow("[BRO$KY] » ") + chalk.yellow(msg));
			break;
		case "blue":
			console.log(chalk.gray("[" + time + "] ") + chalk.yellow("[BRO$KY] » ") + chalk.blue(msg));
			break;
		case "gray":
			console.log(chalk.gray("[" + time + "] ") + chalk.yellow("[BRO$KY] » ") + chalk.gray(msg));
	}
}

let mainWindow = await driver.getWindowHandle();
await driver.manage().window().maximize();
async function loginToEsport() {
	outputToConsole("Logging in to Esports", "blue");
	try {
		await driver.switchTo().window(mainWindow);
		await driver.get("https://lolesports.com/");

		await driver.findElement(By.css('a[data-testid="riotbar:account:button-login"]')).click();

		let username = await driver.wait(until.elementLocated(By.css('input[name="username"]')), 15000);
		await username.sendKeys(config.username);
		let password = await driver.wait(until.elementLocated(By.css('input[name="password"]')), 15000);
		await password.sendKeys(config.password);

		let loginButton = await driver.wait(
			until.elementLocated(By.css('button[type="submit"]')),
			15000
		);
		loginButton.click();
		outputToConsole("Logged in to Esports !", "green");
	} catch (error) {
		// already logged in
		outputToConsole("Already logged in !", "yellow");
	}
}

async function checkWorldGames() {
	outputToConsole("Checking for World Games", "blue");
	await driver.switchTo().window(mainWindow);
	await driver.get("https://lolesports.com/schedule?leagues=worlds");
	let matchElements = await driver.findElements(By.css(".live.event"));
	matches = [];
	for (let match of matchElements) {
		matches.push(await match.getAttribute("href"));
	}
}

async function checkForRewards(url) {
	outputToConsole("Checking if rewards are available", "blue");
	let shouldRefresh = true;
	let tries = 0;
	while (shouldRefresh) {
		// wait until we find selector
		try {
			await driver.wait(until.elementLocated(By.css("div[class='status-summary'] g")), 15000);
			shouldRefresh = false;
			outputToConsole("Rewards are available !", "green");
		} catch (error) {
			tries++;
			if (tries > 3) {
				shouldRefresh = false;
				matches = matches.filter((match) => match !== url);
				await driver.close();
				outputToConsole("Rewards are not available, closing window", "red");
			}
			outputToConsole(
				"Rewards are not available, refreshing incase it was a bug (" + tries + "/3",
				"yellow"
			);
			await driver.navigate().refresh();
			await changeToTwitch();
		}
	}
}

while (true) {
	await loginToEsport();
	await driver.wait(
		until.elementLocated(By.xpath('//*[@id="riotbar-center-content"]/div[2]/div[1]/a')),
		15000
	);
	await checkWorldGames();
	let handles = await driver.getAllWindowHandles();

	// if match is not in matches array, it means its done and we can close the window
	outputToConsole("Closing finished matches", "blue");
	for (let window of handles) {
		await driver.switchTo().window(window);
		let url = await driver.getCurrentUrl();
		if (!matches.includes(url) && window !== mainWindow && !matches.includes(overrides[url])) {
			await driver.close();
		}
	}
	if (handles.length === 1) {
		outputToConsole("No matches to close", "blue");
	}

	let newMatches = [];
	let openedMatches = [];
	for (let window of handles) {
		await driver.switchTo().window(window);
		let url = await driver.getCurrentUrl();
		if (matches.includes(url) || window !== mainWindow || matches.includes(overrides[url])) {
			// add to new matches
			if (matches.includes(url)) {
				openedMatches.push(driver.getCurrentUrl());
			} else {
				openedMatches.push(overrides[url]);
			}
		}
	}
	// remove opened matches from newmatches array
	newMatches = matches.filter((match) => !openedMatches.includes(match));
	outputToConsole("Opening new matches", "blue");
	if (newMatches.length === 0) {
		outputToConsole("No new matches to open", "blue");
	}
	for (let match of newMatches) {
		outputToConsole("Opening match: " + match, "blue");
		await driver.switchTo().newWindow("tab");
		await driver.get(match);

		// switch to twitch
		await changeToTwitch();
		await checkForRewards(match);
	}
	outputToConsole("Waiting 5 minutes before rechecking", "blue");
	await new Promise((resolve) => setTimeout(resolve, 300000));
}

async function changeToTwitch() {
	outputToConsole("Switching to Twitch", "blue");
	try {
		let optionButton = await driver.wait(
			until.elementLocated(By.css("div[class='options-button']")),
			15000
		);

		await optionButton.click();

		let optionSelection = await driver.findElement(
			By.xpath(
				"/html/body/div[2]/main/main/div/div[2]/div[2]/div/div[2]/div/div[2]/div/div[1]/div[2]/div"
			)
		);
		await optionSelection.click();

		try {
			let twitch = await driver.findElement(By.css("li[class='option twitch']"));
			await twitch.click();
		} catch (error) {
			// if twitch is already selected, do nothing
			await optionButton.click();
		}

		outputToConsole("Putting lowest quality", "blue");
		let twitchFrame = await driver.wait(
			until.elementLocated(By.xpath("/html/body/div[4]/div[2]/iframe")),
			15000
		);
		await driver.switchTo().frame(twitchFrame);

		let settingsButton = await driver.wait(
			until.elementLocated(By.css('button[data-a-target="player-settings-button"]')),
			15000
		);

		await driver.executeScript("arguments[0].click();", settingsButton);
		let qualityButton = await driver.wait(
			until.elementLocated(By.css("button[data-a-target=player-settings-menu-item-quality]")),
			15000
		);

		await driver.executeScript("arguments[0].click();", qualityButton);
		await driver.wait(until.elementLocated(By.css('input[data-a-target="tw-radio"]')), 15000);

		let option = await driver.findElements(By.css('input[data-a-target="tw-radio"]'));
		await driver.executeScript("arguments[0].click();", option[option.length - 1]);
		await driver.switchTo().defaultContent();

		outputToConsole("Switched to Twitch", "green");
	} catch (error) {
		console.log(error);
		// do nothing
	}
}
