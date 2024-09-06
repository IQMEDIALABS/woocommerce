<?php
declare( strict_types = 1 );

namespace Automattic\WooCommerce\Blocks\BlockTypes;

/**
 * Product Filter: Attribute Block.
 */
final class ProductFilterCheckboxList extends AbstractBlock {

	/**
	 * Block name.
	 *
	 * @var string
	 */
	protected $block_name = 'product-filter-checkbox-list';


	/**
	 * Get the color value from the color attributes.
	 *
	 * @param string $key        The key of the color attribute.
	 * @param array  $attributes The block attributes.
	 * @return string
	 */
	private function get_color_attribute_value( $key, $attributes ) {
		if ( $attributes[ $key ] ) {
			return $attributes[ $key ];
		}

		if ( $attributes[ 'custom' . ucfirst( $key ) ] ) {
			return $attributes[ 'custom' . ucfirst( $key ) ];
		}

		return '';
	}

	/**
	 * Render the block.
	 *
	 * @param array    $attributes Block attributes.
	 * @param string   $content    Block content.
	 * @param WP_Block $block      Block instance.
	 * @return string Rendered block type output.
	 */
	protected function render( $attributes, $content, $block ) {
		$context               = $block->context['filterData'];
		$items                 = $context['items'] ?? array();
		$checkbox_list_context = array( 'items' => $items );
		$on_change             = $context['on_change'] ?? '';
		$namespace             = wp_json_encode( array( 'namespace' => 'woocommerce/product-filter-checkbox-list' ), JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP );

		$classes = array(
			'has-option-element-border-color'   => $this->get_color_attribute_value( 'optionElementBorder', $attributes ),
			'has-option-element-selected-color' => $this->get_color_attribute_value( 'optionElementSelected', $attributes ),
			'has-option-element-color'          => $this->get_color_attribute_value( 'optionElement', $attributes ),
		);
		$classes = array_filter( $classes );

		$styles = array(
			'--wc-product-filter-checkbox-list-option-element-border' => $this->get_color_attribute_value( 'optionElementBorder', $attributes ),
			'--wc-product-filter-checkbox-list-option-element-selected' => $this->get_color_attribute_value( 'optionElementSelected', $attributes ),
			'--wc-product-filter-checkbox-list-option-element' => $this->get_color_attribute_value( 'optionElement', $attributes ),
		);
		$style  = array_reduce(
			array_keys( $styles ),
			function ( $acc, $key ) use ( $styles ) {
				if ( $styles[ $key ] ) {
					return $acc . "{$key}:  var( --wp--preset--color--{$styles[$key]} );";
				}
			}
		);

		$checked_items               = array_filter(
			$items,
			function ( $item ) {
				return $item['selected'];
			}
		);
		$show_initially              = $context['show_initially'] ?? 15;
		$remaining_initial_unchecked = count( $checked_items ) > $show_initially ? count( $checked_items ) : $show_initially - count( $checked_items );
		$count                       = 0;

		$wrapper_attributes = array(
			'data-wc-interactive' => esc_attr( $namespace ),
			'data-wc-context'     => wp_json_encode( $checkbox_list_context, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP ),
			'class'               => implode( ' ', array_keys( $classes ) ),
			'style'               => $style,
		);

		ob_start();
		?>
		<div <?php echo get_block_wrapper_attributes( $wrapper_attributes ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
			<ul class="wc-block-product-filter-checkbox-list__list">
			<?php foreach ( $items as $item ) { ?>
					<?php
					$item['id'] = $item['id'] ?? uniqid( 'checkbox-' );
					// translators: %s: checkbox label.
					$i18n_label = sprintf( __( 'Checkbox: %s', 'woocommerce' ), $item['aria_label'] ?? '' );
					?>
					<li
						data-wc-key="<?php echo esc_attr( $item['id'] ); ?>"
						<?php
						if ( ! $item['selected'] ) :
							if ( $count >= $remaining_initial_unchecked ) :
								?>
								class="wc-block-product-filter-checkbox-list__item hidden"
								data-wc-class--hidden="!context.showAll"
							<?php else : ?>
								<?php ++$count; ?>
							<?php endif; ?>
						<?php endif; ?>
						class="wc-block-product-filter-checkbox-list__item"
					>
						<label
							class="wc-block-product-filter-checkbox-list__label"
							for="<?php echo esc_attr( $item['id'] ); ?>"
						>
							<span class="wc-block-product-filter-checkbox-list__input-wrapper">
								<input
									id="<?php echo esc_attr( $item['id'] ); ?>"
									class="wc-block-product-filter-checkbox-list__input"
									type="checkbox"
									aria-invalid="false"
									aria-label="<?php echo esc_attr( $i18n_label ); ?>"
									data-wc-on--change--select-item="actions.selectCheckboxItem"
									data-wc-on--change--parent-action="<?php echo esc_attr( $on_change ); ?>"
									value="<?php echo esc_attr( $item['value'] ); ?>"
									<?php checked( $item['selected'], 1 ); ?>
								>
								<svg class="wc-block-product-filter-checkbox-list__mark" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
									<path d="M9.25 1.19922L3.75 6.69922L1 3.94922" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
								</svg>
							</span>
							<span class="wc-block-product-filter-checkbox-list__text">
								<?php echo wp_kses_post( $item['label'] ); ?>
							</span>
						</label>
					</li>
				<?php } ?>
			</ul>
			<?php if ( count( $items ) > $show_initially ) : ?>
				<span
					role="button"
					class="wc-block-product-filter-checkbox-list__show-more"
					data-wc-class--hidden="context.showAll"
					data-wc-on--click="actions.showAllItems"
				>
					<small role="presentation"><?php echo esc_html__( 'Show more...', 'woocommerce' ); ?></small>
				</span>
			<?php endif; ?>
		</div>
		<?php
		return ob_get_clean();
	}
}
