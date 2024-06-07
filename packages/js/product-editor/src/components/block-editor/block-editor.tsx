/**
 * External dependencies
 */
import { parse } from '@wordpress/blocks';
import { SelectControl } from '@wordpress/components';
import {
	createElement,
	useMemo,
	useLayoutEffect,
	useEffect,
	useState,
	lazy,
	Suspense,
} from '@wordpress/element';
import { dispatch, select, useSelect } from '@wordpress/data';
import { uploadMedia } from '@wordpress/media-utils';
import { __ } from '@wordpress/i18n';
import { useLayoutTemplate } from '@woocommerce/block-templates';
import { store as keyboardShortcutsStore } from '@wordpress/keyboard-shortcuts';
import { Product } from '@woocommerce/data';
import {
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore No types for this exist yet.
	BlockContextProvider,
	BlockEditorKeyboardShortcuts,
	BlockEditorProvider,
	BlockList,
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore No types for this exist yet.
	ObserveTyping,
} from '@wordpress/block-editor';
// It doesn't seem to notice the External dependency block whn @ts-ignore is added.
// eslint-disable-next-line @woocommerce/dependency-group
import {
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore store should be included.
	useEntityBlockEditor,
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore store should be included.
	useEntityRecord,
} from '@wordpress/core-data';

type ProductFormProps = {
	id: number;
	date: string;
	date_gmt: string;
	guid: {
		rendered: string;
		raw: string;
	};
	modified: string;
	modified_gmt: string;
	password: string;
	slug: string;
	status: 'publish' | 'future' | 'draft' | 'pending' | 'private';
	type: 'product_form';
	link: string;
	title: {
		raw: string;
		rendered: string;
	};
	content: {
		raw: string;
		rendered: string;
		protected: false;
		block_version: number;
	};
	excerpt: {
		raw: string;
		rendered: string;
		protected: boolean;
	};
	featured_media: number;
	comment_status: 'open' | 'closed';
	ping_status: 'closed' | 'open';
	template: '';
	meta: [];
	permalink_template: string;
	generated_slug: string;
	class_list: string[];
};

/**
 * Internal dependencies
 */
import { useConfirmUnsavedProductChanges } from '../../hooks/use-confirm-unsaved-product-changes';
import { useProductTemplate } from '../../hooks/use-product-template';
import { PostTypeContext } from '../../contexts/post-type-context';
import { store as productEditorUiStore } from '../../store/product-editor-ui';
import { ProductEditorSettings } from '../editor';
import { BlockEditorProps } from './types';
import { ProductTemplate } from '../../types';
import { LoadingState } from './loading-state';

const PluginArea = lazy( () =>
	import( '@wordpress/plugins' ).then( ( module ) => ( {
		default: module.PluginArea,
	} ) )
);

const ModalEditor = lazy( () =>
	import( '../modal-editor' ).then( ( module ) => ( {
		default: module.ModalEditor,
	} ) )
);

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
	context,
	postType,
	productId,
	setIsEditorLoading,
}: BlockEditorProps ) {
	const [ selectedProductFormId, setSelectedProductFormId ] = useState<
		number | null
	>( null );

	useConfirmUnsavedProductChanges( postType );

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

	useEffect( () => {
		// @ts-expect-error Type definitions are missing
		const { registerShortcut } = dispatch( keyboardShortcutsStore );
		if ( registerShortcut ) {
			registerShortcut( {
				name: 'core/editor/save',
				category: 'global',
				description: __( 'Save your changes.', 'woocommerce' ),
				keyCombination: {
					modifier: 'primary',
					character: 's',
				},
			} );
		}
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

		const canUserCreateMedia =
			select( 'core' ).canUser( 'create', 'media', '' ) !== false;

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
	}, [ settingsGlobal ] );

	const { editedRecord: product } = useEntityRecord< Product >(
		'postType',
		postType,
		productId,
		// Only perform the query when the productId is valid.
		{ enabled: productId !== -1 }
	);

	const productTemplateId = useMemo(
		() =>
			product?.meta_data?.find(
				( metaEntry: { key: string } ) =>
					metaEntry.key === '_product_template_id'
			)?.value,
		[ product?.meta_data ]
	);

	const { productTemplate } = useProductTemplate(
		productTemplateId,
		product
	);

	const { layoutTemplate } = useLayoutTemplate(
		getLayoutTemplateId( productTemplate, postType )
	);

	const [ blocks, onInput, onChange ] = useEntityBlockEditor(
		'postType',
		postType,
		// useEntityBlockEditor will not try to fetch the product if productId is falsy.
		{ id: productId !== -1 ? productId : 0 }
	);

	const productForms = useSelect( ( sel ) => {
		return sel( 'core' ).getEntityRecords( 'postType', 'product_form', {
			per_page: -1,
		} );
	}, [] ) as ProductFormProps[];

	useEffect( () => {
		if ( selectedProductFormId || ! productForms ) {
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
		if ( isEditorLoading || ! productForms ) {
			return;
		}

		const productForm = productForms.find(
			( form: ProductFormProps ) => form.id === selectedProductFormId
		);

		if ( ! productForm ) {
			return;
		}

		const productFormTemplate = parse( productForm.content.raw );

		onChange( productFormTemplate, {} );

		dispatch( 'core/editor' ).updateEditorSettings( {
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
	}, [ selectedProductFormId, productId, productForms, isEditorLoading ] );

	// Check if the Modal editor is open from the store.
	const isModalEditorOpen = useSelect( ( selectCore ) => {
		return selectCore( productEditorUiStore ).isModalEditorOpen();
	}, [] );

	if ( isEditorLoading ) {
		return (
			<div className="woocommerce-product-block-editor">
				<LoadingState />
			</div>
		);
	}

	if ( isModalEditorOpen ) {
		return (
			<Suspense fallback={ null }>
				<ModalEditor
					onClose={
						dispatch( productEditorUiStore ).closeModalEditor
					}
					title={ __( 'Edit description', 'woocommerce' ) }
				/>
			</Suspense>
		);
	}

	const formValues = productForms?.map( ( form ) => ( {
		label: form.title.raw,
		value: String( form.id ),
	} ) );

	return (
		<div className="woocommerce-product-block-editor">
			<SelectControl
				label={ __( 'Choose product type', 'woocommerce' ) }
				options={ formValues }
				onChange={ ( value: string ) =>
					setSelectedProductFormId( parseInt( value, 10 ) )
				}
				disabled={ ! productForms }
				className="woocommerce-product-block-editor__product-type-selector"
			/>
			<BlockContextProvider value={ context }>
				<BlockEditorProvider
					value={ blocks }
					onInput={ onInput }
					onChange={ onChange }
					settings={ settings }
					useSubRegistry={ false }
				>
					{ /* eslint-disable-next-line @typescript-eslint/ban-ts-comment */ }
					{ /* @ts-ignore No types for this exist yet. */ }
					<BlockEditorKeyboardShortcuts.Register />
					<ObserveTyping>
						{ isEditorLoading ? (
							<LoadingState />
						) : (
							<BlockList className="woocommerce-product-block-editor__block-list" />
						) }
					</ObserveTyping>
					{ /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */ }
					<PostTypeContext.Provider value={ context.postType! }>
						<Suspense fallback={ null }>
							{ /* @ts-expect-error 'scope' does exist. @types/wordpress__plugins is outdated. */ }
							<PluginArea scope="woocommerce-product-block-editor" />
						</Suspense>
					</PostTypeContext.Provider>
				</BlockEditorProvider>
			</BlockContextProvider>
		</div>
	);
}
