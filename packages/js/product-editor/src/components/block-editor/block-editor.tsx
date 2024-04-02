/**
 * External dependencies
 */
import { SelectControl } from '@wordpress/components';
import { useCallback } from 'react';
import {
	createElement,
	useMemo,
	useLayoutEffect,
	useEffect,
	useState,
} from '@wordpress/element';
import { useDispatch, useSelect, select as WPSelect } from '@wordpress/data';
import { uploadMedia } from '@wordpress/media-utils';
import { __ } from '@wordpress/i18n';
import { useLayoutTemplate } from '@woocommerce/block-templates';
// It doesn't seem to notice the External dependency block whn @ts-ignore is added.
// eslint-disable-next-line @woocommerce/dependency-group
import {
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore store should be included.
	useEntityRecord,
} from '@wordpress/core-data';

/**
 * Internal dependencies
 */
import useProductEntityProp from '../../hooks/use-product-entity-prop';
import { useConfirmUnsavedProductChanges } from '../../hooks/use-confirm-unsaved-product-changes';
import { useProductTemplate } from '../../hooks/use-product-template';
import { store as productEditorUiStore } from '../../store/product-editor-ui';
import { ModalEditor } from '../modal-editor';
import { ProductEditorSettings } from '../editor';
import { BlockEditorProps } from './types';
import { ProductTemplate } from '../../types';
import { getRenderedBlockView } from '../../utils/get-rendered-block-view';

function getLayoutTemplateId(
	productTemplate: ProductTemplate | undefined,
	postType: string
) {
	if ( productTemplate?.layoutTemplateId ) {
		return productTemplate.layoutTemplateId;
	}

	if ( postType === 'product_variation' ) {
		return 'product-variation';
	}

	// Fallback to simple product if no layout template is set.
	return 'simple-product';
}

export function BlockEditor( {
	postType,
	productId,
	setIsEditorLoading,
}: BlockEditorProps ) {
	const [ selectedProductFormId, setSelectedProductFormId ] = useState<
		number | null
	>( null );

	useConfirmUnsavedProductChanges( postType );

	const canUserCreateMedia = useSelect( ( select: typeof WPSelect ) => {
		const { canUser } = select( 'core' );
		return canUser( 'create', 'media', '' ) !== false;
	}, [] );

	/**
	 * Fire wp-pin-menu event once to trigger the pinning of the menu.
	 * That can be necessary since wpwrap's height wasn't being recalculated after the skeleton
	 * is switched to the real content, which is usually larger
	 */
	useEffect( () => {
		const wpPinMenuEvent = () => {
			document.dispatchEvent( new Event( 'wp-pin-menu' ) );
		};
		window.addEventListener( 'scroll', wpPinMenuEvent, { once: true } );
		return () => window.removeEventListener( 'scroll', wpPinMenuEvent );
	}, [] );

	const [ settingsGlobal, setSettingsGlobal ] = useState<
		Partial< ProductEditorSettings > | undefined
	>( undefined );

	useEffect( () => {
		let timeoutId: number;

		const checkSettingsGlobal = () => {
			if ( window.productBlockEditorSettings !== undefined ) {
				setSettingsGlobal( window.productBlockEditorSettings );
			} else {
				timeoutId = setTimeout( checkSettingsGlobal, 100 );
			}
		};

		checkSettingsGlobal();

		return () => {
			clearTimeout( timeoutId );
		};
	}, [] );

	const settings = useMemo<
		Partial< ProductEditorSettings > | undefined
	>( () => {
		if ( settingsGlobal === undefined ) {
			return undefined;
		}

		const mediaSettings = canUserCreateMedia
			? {
					mediaUpload( {
						onError,
						...rest
					}: {
						onError: ( message: string ) => void;
					} ) {
						// eslint-disable-next-line @typescript-eslint/ban-ts-comment
						// @ts-ignore No types for this exist yet.
						uploadMedia( {
							wpAllowedMimeTypes:
								settingsGlobal.allowedMimeTypes || undefined,
							onError: ( { message } ) => onError( message ),
							...rest,
						} );
					},
			  }
			: {};

		return {
			...settingsGlobal,
			...mediaSettings,
			templateLock: 'all',
		};
	}, [ settingsGlobal, canUserCreateMedia ] );

	const [ productTemplateId ] = useProductEntityProp< string >(
		'meta_data._product_template_id',
		{ postType }
	);

	const { record: product } = useEntityRecord(
		'postType',
		postType,
		productId
	);

	const { productTemplate } = useProductTemplate(
		productTemplateId,
		product
	);

	const { layoutTemplate } = useLayoutTemplate(
		getLayoutTemplateId( productTemplate, postType )
	);

	const { updateEditorSettings } = useDispatch( 'core/editor' );

	const productForms = useSelect( ( select ) => {
		return (
			select( 'core' ).getEntityRecords( 'postType', 'product_form', {
				per_page: -1,
			} ) || []
		);
	}, [] );

	useEffect( () => {
		if ( selectedProductFormId || ! productForms.length ) {
			return;
		}

		setSelectedProductFormId( productForms[ 0 ].id );
	}, [ selectedProductFormId, productForms ] );

	const isEditorLoading =
		! settings ||
		! layoutTemplate ||
		// variations don't have a product template
		( postType !== 'product_variation' && ! productTemplate ) ||
		productId === -1;

	useLayoutEffect( () => {
		if ( isEditorLoading || ! productForms.length ) {
			return;
		}

		const productForm = productForms.find(
			( form ) => form.id === selectedProductFormId
		);

		if ( ! productForm ) {
			return;
		}

		updateEditorSettings( {
			...settings,
			productTemplate,
		} as Partial< ProductEditorSettings > );

		setIsEditorLoading( isEditorLoading );

		// We don't need to include onChange or updateEditorSettings in the dependencies,
		// since we get new instances of them on every render, which would cause an infinite loop.
		//
		// We include productId in the dependencies to make sure that the effect is run when the
		// product is changed, since we need to synchronize the blocks with the template and update
		// the blocks by calling onChange.
		//
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ selectedProductFormId, settings, productId, productForms ] );

	const selectedProductForm = productForms.find(
		( productForm ) => productForm.id === selectedProductFormId
	);

	const ProductForm = useCallback( () => {
		if ( ! selectedProductForm ) {
			return <div>Loading</div>;
		}

		const container = document.createElement( 'div' );
		container.innerHTML = selectedProductForm.content.rendered;
		return (
			<div className="woocommerce-product-block-editor__product-form">
				{ getRenderedBlockView( container ) }
			</div>
		);
	}, [ selectedProductForm ] );

	// Check if the Modal editor is open from the store.
	const isModalEditorOpen = useSelect( ( select ) => {
		return select( productEditorUiStore ).isModalEditorOpen();
	}, [] );

	const { closeModalEditor } = useDispatch( productEditorUiStore );

	if ( isModalEditorOpen ) {
		return (
			<ModalEditor
				onClose={ closeModalEditor }
				title={ __( 'Edit description', 'woocommerce' ) }
			/>
		);
	}

	return (
		<div className="woocommerce-product-block-editor">
			<SelectControl
				label={ __( 'Choose product type', 'woocommerce' ) }
				options={ productForms?.map( ( form ) => ( {
					label: form.title.raw,
					value: form.id,
				} ) ) }
				onChange={ ( value: string ) =>
					setSelectedProductFormId( parseInt( value, 10 ) )
				}
				disabled={ ! productForms }
				className="woocommerce-product-block-editor__product-type-selector"
			/>
			<ProductForm />
		</div>
	);
}
