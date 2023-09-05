/**
* External dependencies
*/
const chalk = require( 'chalk' );
const { join } = require( 'path' );

module.exports = {
	defaultValues: {
		namespace: 'extension',
		slug: 'example-product-editor-block',
		version: '0.1.0',
		category: 'widgets',
		title: 'Example Product Editor Block',
		description: 'A block to demonstrate extending the Product Editor',
		dashicon: 'flag',
		license: 'GPL-3.0+',
		attributes: {
			message: {
				type: 'string',
				source: 'text',
				selector: 'div',
			},
		},
		supports: {
			html: false,
			inserter: false,
		},
		npmDevDependencies: [
			'@types/wordpress__block-editor@^7.0.0',
			'@types/wordpress__blocks@^11.0.9',
			'@woocommerce/dependency-extraction-webpack-plugin',
			'@woocommerce/eslint-plugin',
			'@wordpress/prettier-config',
			'@wordpress/stylelint-config',
			'eslint-import-resolver-typescript',
		],
		customScripts: {
			postinstall: 'composer install',
		},
		wpScripts: true,
		wpEnv: true,
		editorScript: 'file:./index.js',
		editorStyle: 'file:./index.css',
	},
	includesTemplatesPath: join( __dirname, 'templates', 'includes' ),
	srcTemplatesPath: join( __dirname, 'templates', 'src' ),
	pluginTemplatesPath: join( __dirname, 'templates', 'plugin' ),
	modules: [ 'BlockRegistry' ],
	composerDependencies: [
		'automattic/jetpack-autoloader'
	],
	onComplete: () => {
		console.log( '' );
		console.log( chalk.bold.green( 'Template installation successful! Please initialize the template module in your plugin by adding the following lines:' ) );

		console.log( '' );
		console.log( chalk.cyan( "require_once plugin_dir_path( __FILE__ ) . '/vendor/autoload_packages.php';") );
		console.log( chalk.cyan( "$package = new SamplePlugin\\Package( plugin_dir_path( __FILE__ ) ); ) );") );
	},
};
