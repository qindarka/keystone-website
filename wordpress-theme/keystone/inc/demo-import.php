<?php
/**
 * One-click demo content importer.
 *
 * Self-contained: parses the bundled WXR with SimpleXML and calls
 * wp_insert_post() for each item. Doesn't depend on the WordPress
 * Importer plugin (which has surprising boot-order quirks on shared
 * hosting). Skips items whose slug already exists, so re-running is
 * safe and idempotent.
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
		<p style="font-size:14px;"><strong>Keystone theme:</strong> Import demo content (all pages, 8 services, ~50 knowledge articles) so you can see the site populated. Safe to re-run — already-imported items are skipped.</p>
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
		$result = keystone_import_demo_content();

		if ( is_wp_error( $result ) ) {
			wp_die(
				'<h1>Demo import failed</h1><p>' . esc_html( $result->get_error_message() ) . '</p>',
				'Import error',
				[ 'response' => 200, 'back_link' => true ]
			);
		}

		update_option( KEYSTONE_DEMO_FLAG, 'imported' );
		wp_safe_redirect( add_query_arg( 'keystone-imported', (int) $result, admin_url( 'edit.php?post_status=publish&post_type=page' ) ) );
		exit;
	}
} );

/**
 * Parse demo-content.xml and create posts one at a time.
 *
 * Uses SimpleXML (built into PHP — no plugin dependency). Idempotent:
 * if a post with the same slug + post_type already exists, it's skipped.
 *
 * @return int|WP_Error  Count of items inserted, or WP_Error on parse failure.
 */
function keystone_import_demo_content() {
	@ini_set( 'memory_limit', '512M' );
	@set_time_limit( 300 );

	$wxr = KEYSTONE_DIR . '/inc/demo-content.xml';
	if ( ! file_exists( $wxr ) ) {
		return new WP_Error( 'no_wxr', 'demo-content.xml is missing from the theme.' );
	}

	libxml_use_internal_errors( true );
	$xml = simplexml_load_file( $wxr );
	if ( ! $xml ) {
		$errs = array_map( function ( $e ) { return trim( $e->message ); }, libxml_get_errors() );
		libxml_clear_errors();
		return new WP_Error( 'bad_xml', 'Could not parse demo-content.xml: ' . implode( '; ', $errs ) );
	}

	// Make sure the "Knowledge" category exists before we attach posts to it.
	if ( ! term_exists( 'knowledge', 'category' ) ) {
		wp_insert_term( 'Knowledge', 'category', [ 'slug' => 'knowledge' ] );
	}

	// Speed up bulk inserts.
	wp_defer_term_counting( true );
	wp_defer_comment_counting( true );
	wp_suspend_cache_invalidation( true );

	$count   = 0;
	$skipped = 0;

	$NS_WP      = 'http://wordpress.org/export/1.2/';
	$NS_CONTENT = 'http://purl.org/rss/1.0/modules/content/';
	$NS_EXCERPT = 'http://wordpress.org/export/1.2/excerpt/';

	foreach ( $xml->channel->item as $item ) {
		$wp      = $item->children( $NS_WP );
		$content = $item->children( $NS_CONTENT )->encoded ?? '';
		$excerpt = $item->children( $NS_EXCERPT )->encoded ?? '';

		$post_type = (string) ( $wp->post_type ?? 'post' );
		$slug      = (string) ( $wp->post_name ?? '' );
		$status    = (string) ( $wp->status    ?? 'publish' );
		$title     = (string) $item->title;

		if ( ! $slug || ! $title ) { $skipped++; continue; }

		// Idempotency: skip if a post with this slug + type already exists.
		$existing = get_page_by_path( $slug, OBJECT, $post_type );
		if ( $existing ) { $skipped++; continue; }

		$postarr = [
			'post_title'     => $title,
			'post_name'      => $slug,
			'post_content'   => (string) $content,
			'post_excerpt'   => (string) $excerpt,
			'post_status'    => $status,
			'post_type'      => $post_type,
			'menu_order'     => (int) ( $wp->menu_order ?? 0 ),
			'comment_status' => 'closed',
			'ping_status'    => 'closed',
		];

		$post_date = (string) ( $wp->post_date ?? '' );
		if ( $post_date ) {
			$postarr['post_date']     = $post_date;
			$postarr['post_date_gmt'] = $post_date;
		}

		$post_id = wp_insert_post( $postarr, true );
		if ( is_wp_error( $post_id ) ) { $skipped++; continue; }

		// Posts → attach to category(ies) listed in the WXR <category> nodes.
		if ( $post_type === 'post' ) {
			$cat_ids = [];
			foreach ( $item->category as $c ) {
				$nicename = (string) $c['nicename'];
				if ( ! $nicename ) continue;
				$term = get_term_by( 'slug', $nicename, 'category' );
				if ( $term ) $cat_ids[] = (int) $term->term_id;
			}
			if ( $cat_ids ) wp_set_post_categories( $post_id, $cat_ids );
		}

		$count++;
	}

	wp_defer_term_counting( false );
	wp_defer_comment_counting( false );
	wp_suspend_cache_invalidation( false );

	return $count;
}

// Friendly success notice after import.
add_action( 'admin_notices', function () {
	if ( empty( $_GET['keystone-imported'] ) ) return;
	$n = (int) $_GET['keystone-imported'];
	echo '<div class="notice notice-success is-dismissible"><p><strong>Keystone:</strong> Imported ' . $n . ' items. Existing slugs were skipped.</p></div>';
} );
