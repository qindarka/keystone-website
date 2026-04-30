<?php
/**
 * One-click "fix article dates" admin action.
 *
 * The first round of demo imports stamped every article with the import
 * date (NOW). This tool reads inc/article-dates.json (built from the
 * static knowledge.html index) and updates each post's post_date to its
 * original publication date.
 *
 * Idempotent: running it again is a no-op once dates already match.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

const KEYSTONE_DATES_FLAG = 'keystone_article_dates_fixed';

function keystone_fix_article_dates() {
	$json_path = KEYSTONE_DIR . '/inc/article-dates.json';
	if ( ! file_exists( $json_path ) ) {
		return new WP_Error( 'no_json', 'article-dates.json missing from theme.' );
	}
	$dates = json_decode( file_get_contents( $json_path ), true );
	if ( ! is_array( $dates ) ) {
		return new WP_Error( 'bad_json', 'article-dates.json could not be parsed.' );
	}

	$fixed = 0;
	$skipped = 0;
	foreach ( $dates as $slug => $date ) {
		$post = get_page_by_path( $slug, OBJECT, 'post' );
		if ( ! $post ) { $skipped++; continue; }
		if ( $post->post_date === $date ) { $skipped++; continue; }

		// wp_update_post will sanity-check + recompute post_date_gmt.
		$result = wp_update_post( [
			'ID'            => $post->ID,
			'post_date'     => $date,
			'post_date_gmt' => get_gmt_from_date( $date ),
		], true );

		if ( ! is_wp_error( $result ) ) $fixed++;
		else $skipped++;
	}

	return [ 'fixed' => $fixed, 'skipped' => $skipped, 'total' => count( $dates ) ];
}

/**
 * Detect if any imported article still has the import-day date instead of
 * its real publication date. If so, surface the admin notice.
 */
function keystone_dates_need_fixing() {
	$json_path = KEYSTONE_DIR . '/inc/article-dates.json';
	if ( ! file_exists( $json_path ) ) return false;

	$dates = json_decode( file_get_contents( $json_path ), true );
	if ( ! is_array( $dates ) ) return false;

	foreach ( $dates as $slug => $date ) {
		$post = get_page_by_path( $slug, OBJECT, 'post' );
		if ( $post && $post->post_date !== $date ) return true;
	}
	return false;
}

add_action( 'admin_notices', function () {
	if ( ! current_user_can( 'manage_options' ) ) return;
	if ( get_option( KEYSTONE_DATES_FLAG ) === 'skipped' ) return;
	if ( ! keystone_dates_need_fixing() ) return;

	$url = wp_nonce_url(
		add_query_arg( 'keystone-fix-dates', '1', admin_url() ),
		'keystone_fix_dates'
	);
	$skip = wp_nonce_url(
		add_query_arg( 'keystone-skip-dates', '1', admin_url() ),
		'keystone_skip_dates'
	);
	?>
	<div class="notice notice-info is-dismissible" style="border-left-color:#ffb819;">
		<p style="font-size:14px;"><strong>Keystone theme:</strong> Some imported articles are still using the import date instead of their original publication dates. Click below to restore the real dates.</p>
		<p>
			<a href="<?php echo esc_url( $url ); ?>" class="button button-primary">Fix article dates</a>
			<a href="<?php echo esc_url( $skip ); ?>" class="button">Skip — leave as-is</a>
		</p>
	</div>
	<?php
} );

add_action( 'admin_init', function () {
	if ( ! current_user_can( 'manage_options' ) ) return;

	if ( isset( $_GET['keystone-skip-dates'] ) ) {
		check_admin_referer( 'keystone_skip_dates' );
		update_option( KEYSTONE_DATES_FLAG, 'skipped' );
		wp_safe_redirect( admin_url() );
		exit;
	}

	if ( isset( $_GET['keystone-fix-dates'] ) ) {
		check_admin_referer( 'keystone_fix_dates' );
		$result = keystone_fix_article_dates();
		if ( is_wp_error( $result ) ) {
			wp_die( esc_html( $result->get_error_message() ), 'Date fix failed', [ 'response' => 200, 'back_link' => true ] );
		}
		set_transient( 'keystone_dates_fix_result', $result, 30 );
		wp_safe_redirect( admin_url() );
		exit;
	}
} );

add_action( 'admin_notices', function () {
	$result = get_transient( 'keystone_dates_fix_result' );
	if ( ! $result ) return;
	delete_transient( 'keystone_dates_fix_result' );
	echo '<div class="notice notice-success is-dismissible"><p><strong>Keystone:</strong> Updated ' . (int) $result['fixed'] . ' article date(s); skipped ' . (int) $result['skipped'] . ' (already correct or post not found).</p></div>';
} );
