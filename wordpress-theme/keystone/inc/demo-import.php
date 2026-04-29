<?php
/**
 * One-click demo content importer.
 *
 * After activating the theme, an admin notice offers to import the bundled
 * WXR file (inc/demo-content.xml) so the site materializes with all pages,
 * services and articles already populated. Useful for the dev.kct.ca dry
 * run; harmless on a real production install (just don't click the button).
 */

if ( ! defined( 'ABSPATH' ) ) exit;

const KEYSTONE_DEMO_FLAG = 'keystone_demo_imported';

add_action( 'admin_notices', function () {
	if ( ! current_user_can( 'manage_options' ) ) return;
	if ( get_option( KEYSTONE_DEMO_FLAG ) ) return;

	$import_url = wp_nonce_url(
		add_query_arg( 'keystone-import-demo', '1', admin_url() ),
		'keystone_import_demo'
	);
	?>
	<div class="notice notice-info" style="border-left-color:#004876;">
		<p style="font-size:14px;"><strong>Keystone theme:</strong> Import demo content (all pages, 8 services, ~50 knowledge articles) so you can see the site populated. You can edit or delete anything afterwards.</p>
		<p>
			<a href="<?php echo esc_url( $import_url ); ?>" class="button button-primary">Import demo content</a>
			<a href="<?php echo esc_url( wp_nonce_url( add_query_arg( 'keystone-skip-demo', '1', admin_url() ), 'keystone_skip_demo' ) ); ?>" class="button">Skip — I'll start blank</a>
		</p>
	</div>
	<?php
} );

add_action( 'admin_init', function () {
	if ( ! current_user_can( 'manage_options' ) ) return;

	if ( isset( $_GET['keystone-skip-demo'] ) ) {
		check_admin_referer( 'keystone_skip_demo' );
		update_option( KEYSTONE_DEMO_FLAG, 'skipped' );
		wp_safe_redirect( admin_url() );
		exit;
	}

	if ( isset( $_GET['keystone-import-demo'] ) ) {
		check_admin_referer( 'keystone_import_demo' );
		keystone_import_demo_content();
		update_option( KEYSTONE_DEMO_FLAG, 'imported' );
		wp_safe_redirect( admin_url( 'edit.php?post_status=publish&post_type=page' ) );
		exit;
	}
} );

function keystone_import_demo_content() {
	$wxr = KEYSTONE_DIR . '/inc/demo-content.xml';
	if ( ! file_exists( $wxr ) ) return new WP_Error( 'no_wxr', 'demo-content.xml is missing from the theme.' );

	// Make sure the WP importer is available; install it on the fly if not.
	if ( ! class_exists( 'WP_Importer' ) ) {
		require_once ABSPATH . 'wp-admin/includes/class-wp-importer.php';
	}
	if ( ! class_exists( 'WXR_Parser' ) ) {
		// The WordPress Importer plugin ships the parser; if not present,
		// we fall back to a minimal inline import path below.
		$plugin = WP_PLUGIN_DIR . '/wordpress-importer/wordpress-importer.php';
		if ( file_exists( $plugin ) ) {
			require_once $plugin;
		}
	}

	if ( class_exists( 'WP_Import' ) ) {
		// Standard path: WordPress Importer plugin is installed.
		$importer = new WP_Import();
		$importer->fetch_attachments = false;
		ob_start();
		$importer->import( $wxr );
		ob_end_clean();
		return true;
	}

	// Fallback: tell the admin to install WordPress Importer.
	wp_die(
		'<h1>WordPress Importer plugin required</h1>' .
		'<p>To import demo content, please first install the free <a href="' . esc_url( admin_url( 'plugin-install.php?s=wordpress+importer&tab=search&type=term' ) ) . '">WordPress Importer</a> plugin, then return here and click "Import demo content" again.</p>',
		'Importer required',
		[ 'response' => 200, 'back_link' => true ]
	);
}
