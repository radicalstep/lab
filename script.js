document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の取得 (変更なし)
    const filterList = document.getElementById('filter-list');
    const rightPaneHeaderTitle = document.getElementById('right-pane-header-title');
    const closeDetailViewButton = document.getElementById('close-detail-view-button');
    const photoGalleryContainer = document.getElementById('photo-gallery-container');
    const detailViewContainer = document.getElementById('detail-view-container');
    const detailSingleImageView = document.getElementById('detail-single-image-view');
    const detailModalImage = document.getElementById('detail-modal-image');
    const detailSideBySideView = document.getElementById('detail-side-by-side-view');
    const detailSbsAnimeImage = document.getElementById('detail-sbs-anime-image');
    const detailSbsRealImage = document.getElementById('detail-sbs-real-image');
    const detailToggleComparisonButton = document.getElementById('detail-toggle-comparison-button');
    const detailTitle = document.getElementById('detail-title');
    const detailAnimeTitleDisplay = document.getElementById('detail-anime-title-display');
    const detailPhotoDescription = document.getElementById('detail-photo-description');
    const detailDatetimeOriginal = document.getElementById('detail-datetime-original');
    const detailMapElement = document.getElementById('detail-map-element');
    const detailStreetviewLink = document.getElementById('detail-streetview-link');

    let allPhotosData = [];
    let currentPhotoData = null;
    let isRealImageDisplayedInSingleView = true;
    let isDetailSideBySideActive = false;
    let detailMap = null;
    let currentMapMarker = null;

    async function loadPhotoData() {
        try {
            const response = await fetch('photos.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            allPhotosData = await response.json();
            populateFilters(); // ★ フィルター項目を生成
            initializeGallery();
        } catch (error) {
            console.error("写真データの読み込みに失敗しました:", error);
            photoGalleryContainer.innerHTML = '<p style="color: red; text-align: center;">写真データの読み込みに失敗しました。</p>';
        }
    }

    // ★ フィルター項目を動的に生成する関数
    function populateFilters() {
        filterList.innerHTML = ''; // 既存のフィルターをクリア

        // 「すべて」フィルターを追加
        const allFilterItem = document.createElement('li');
        allFilterItem.classList.add('filter-item', 'active'); // 最初は「すべて」をアクティブに
        allFilterItem.dataset.filter = 'all';
        allFilterItem.textContent = 'すべて';
        filterList.appendChild(allFilterItem);

        // 写真データからユニークなアニメタイトルを取得
        const animeFilters = [];
        allPhotosData.forEach(photo => {
            // 既にリストにないアニメタイトルとフィルタータグのペアのみ追加
            if (!animeFilters.some(f => f.tag === photo.animeFilterTag)) {
                animeFilters.push({
                    tag: photo.animeFilterTag,
                    display: photo.animeTitleDisplay
                });
            }
        });

        // アニメタイトルでソート (任意)
        animeFilters.sort((a, b) => a.display.localeCompare(b.display, 'ja'));

        // 各アニメのフィルター項目を追加
        animeFilters.forEach(filter => {
            const filterItem = document.createElement('li');
            filterItem.classList.add('filter-item');
            filterItem.dataset.filter = filter.tag;
            filterItem.textContent = filter.display; // 表示名を使用
            filterList.appendChild(filterItem);
        });
    }


    function initializeGallery() {
        photoGalleryContainer.classList.add('active-content');
        displayPhotos(allPhotosData);
    }

    function displayPhotos(photosToDisplay) {
        photoGalleryContainer.innerHTML = '';
        photosToDisplay.forEach(photo => {
            const tile = document.createElement('div');
            tile.classList.add('photo-tile');
            tile.dataset.photoId = photo.id;
            const img = document.createElement('img');
            img.src = photo.realSrc;
            img.alt = photo.title;
            const infoDiv = document.createElement('div');
            infoDiv.classList.add('photo-tile-info');
            infoDiv.innerHTML = `
                <span class="title">${photo.title}</span>
                <span class="anime-title">${photo.animeTitleDisplay}</span>
            `;
            tile.appendChild(img);
            tile.appendChild(infoDiv);
            photoGalleryContainer.appendChild(tile);
            tile.addEventListener('click', () => openDetailView(photo.id));
        });
    }

    async function fetchExifDataWithExifJS(imageSrc) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = function() {
                EXIF.getData(img, function() {
                    const tags = EXIF.getAllTags(this);
                    const lat = EXIF.getTag(this, "GPSLatitude");
                    const lon = EXIF.getTag(this, "GPSLongitude");
                    const latRef = EXIF.getTag(this, "GPSLatitudeRef");
                    const lonRef = EXIF.getTag(this, "GPSLongitudeRef");
                    let dateTimeOriginal = EXIF.getTag(this, "DateTimeOriginal");
                    let exifInfo = { latitude: null, longitude: null, dateTimeOriginal: null, error: null };
                    if (lat && lon && latRef && lonRef && lat.length === 3 && lon.length === 3) {
                        exifInfo.latitude = convertDMSToDD(lat[0].valueOf(), lat[1].valueOf(), lat[2].valueOf(), latRef);
                        exifInfo.longitude = convertDMSToDD(lon[0].valueOf(), lon[1].valueOf(), lon[2].valueOf(), lonRef);
                    } else {
                        if (!exifInfo.error) exifInfo.error = "位置情報なし";
                    }
                    if (dateTimeOriginal) {
                        const parts = dateTimeOriginal.split(" ");
                        if (parts.length === 2) {
                            const dateParts = parts[0].split(":");
                            if (dateParts.length === 3) {
                                exifInfo.dateTimeOriginal = `${dateParts[0]}-${dateParts[1]}-${dateParts[2]}T${parts[1]}`;
                            } else {
                                if (!exifInfo.error) exifInfo.error = "日時形式不正";
                            }
                        } else {
                             if (!exifInfo.error) exifInfo.error = "日時形式不正";
                        }
                    }
                    resolve(exifInfo);
                });
            };
            img.onerror = function() {
                resolve({ latitude: null, longitude: null, dateTimeOriginal: null, error: "画像読み込み失敗" });
            }
            img.src = imageSrc;
        });
    }

    function convertDMSToDD(degrees, minutes, seconds, direction) {
        let dd = parseFloat(degrees) + parseFloat(minutes) / 60 + parseFloat(seconds) / (60 * 60);
        if (direction == "S" || direction == "W") {
            dd = dd * -1;
        }
        return dd;
    }

    async function openDetailView(photoId) {
        currentPhotoData = allPhotosData.find(p => p.id === parseInt(photoId));
        if (!currentPhotoData) return;

        photoGalleryContainer.classList.remove('active-content');
        detailViewContainer.classList.add('active-content');
        rightPaneHeaderTitle.textContent = currentPhotoData.title;
        closeDetailViewButton.style.display = 'inline-block';

        isRealImageDisplayedInSingleView = true;
        detailModalImage.src = currentPhotoData.realSrc;
        detailSbsAnimeImage.src = currentPhotoData.animeSrc;
        detailSbsRealImage.src = currentPhotoData.realSrc;
        switchToDetailSingleView();

        detailTitle.textContent = currentPhotoData.title;
        detailAnimeTitleDisplay.textContent = `アニメ: ${currentPhotoData.animeTitleDisplay}`;
        detailPhotoDescription.textContent = currentPhotoData.description;

        detailMapElement.innerHTML = '<p style="text-align:center; padding-top: 20px; color: #777;">位置情報を読み込み中...</p>';
        detailStreetviewLink.style.display = 'none';
        detailDatetimeOriginal.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 日時情報読み込み中...';

        const exifInfo = await fetchExifDataWithExifJS(currentPhotoData.realSrc);
        let mapErrorMessage = exifInfo.error || "位置情報はありません。";

        if (exifInfo.latitude && exifInfo.longitude) {
            detailMapElement.innerHTML = '';
            setupMap(exifInfo.latitude, exifInfo.longitude, currentPhotoData.title);
            const streetViewUrl = `https://www.google.com/maps?q&layer=c&cbll=${exifInfo.latitude},${exifInfo.longitude}`;
            detailStreetviewLink.href = streetViewUrl;
            detailStreetviewLink.style.display = 'inline-block';
            detailStreetviewLink.innerHTML = `<i class="fas fa-street-view"></i> 「${currentPhotoData.title}」をストリートビューで見る`;
        } else {
            detailMapElement.innerHTML = `<p style="text-align:center; padding-top: 20px; color: #777;">${mapErrorMessage}</p>`;
             if(detailMap && currentMapMarker) {
                detailMap.removeLayer(currentMapMarker);
                currentMapMarker = null;
            }
        }

        if (exifInfo.dateTimeOriginal) {
            try {
                const date = new Date(exifInfo.dateTimeOriginal);
                if (isNaN(date.getTime())) {
                    throw new Error("Invalid date object");
                }
                const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Tokyo' };
                detailDatetimeOriginal.innerHTML = `<i class="far fa-calendar-alt"></i> 撮影日時: ${date.toLocaleString('ja-JP', options)}`;
            } catch(e) {
                detailDatetimeOriginal.innerHTML = `<i class="far fa-calendar-alt"></i> 撮影日時: ${exifInfo.dateTimeOriginal || '取得エラー'} (書式エラーの可能性あり)`;
            }
        } else if (exifInfo.error && !exifInfo.dateTimeOriginal) { // エラーがあり、かつ日時も取れていない場合
             detailDatetimeOriginal.innerHTML = `<i class="far fa-calendar-alt"></i> 日時情報: ${exifInfo.error}`;
        }
         else {
            detailDatetimeOriginal.innerHTML = `<i class="far fa-calendar-alt"></i> 撮影日時情報はありません。`;
        }
    }

    function setupMap(lat, lon, title) {
        if (!detailMap) {
            detailMap = L.map(detailMapElement, { attributionControl: false }).setView([lat, lon], 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(detailMap);
            L.control.attribution({prefix: '<a href="https://leafletjs.com" title="A JS library for interactive maps">Leaflet</a> | © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(detailMap);
        } else {
            detailMap.setView([lat, lon], 15);
        }
        if (currentMapMarker) {
            detailMap.removeLayer(currentMapMarker);
        }
        currentMapMarker = L.marker([lat, lon]).addTo(detailMap).bindPopup(title || '撮影場所').openPopup();
        setTimeout(() => {
            if (detailMap && detailViewContainer.classList.contains('active-content')) {
                detailMap.invalidateSize();
            }
        }, 100);
    }

    function closeDetailView() {
        detailViewContainer.classList.remove('active-content');
        photoGalleryContainer.classList.add('active-content');
        rightPaneHeaderTitle.textContent = '聖地写真ギャラリー';
        closeDetailViewButton.style.display = 'none';
        currentPhotoData = null;
        if (detailMap && currentMapMarker) {
            detailMap.removeLayer(currentMapMarker);
            currentMapMarker = null;
        }
    }
    closeDetailViewButton.addEventListener('click', closeDetailView);

    function switchToDetailSingleView() {
        detailSingleImageView.classList.add('active-detail-image-display');
        detailSideBySideView.classList.remove('active-detail-image-display');
        detailToggleComparisonButton.textContent = '左右で比較する';
        isDetailSideBySideActive = false;
    }

    function switchToDetailSideBySideView() {
        detailSingleImageView.classList.remove('active-detail-image-display');
        detailSideBySideView.classList.add('active-detail-image-display');
        detailToggleComparisonButton.textContent = '1枚表示に戻す';
        isDetailSideBySideActive = true;
    }

    detailModalImage.addEventListener('click', () => {
        if (!currentPhotoData || isDetailSideBySideActive) return;
        if (isRealImageDisplayedInSingleView) {
            detailModalImage.src = currentPhotoData.animeSrc;
        } else {
            detailModalImage.src = currentPhotoData.realSrc;
        }
        isRealImageDisplayedInSingleView = !isRealImageDisplayedInSingleView;
    });

    detailToggleComparisonButton.addEventListener('click', () => {
        if (!currentPhotoData) return;
        if (isDetailSideBySideActive) {
            switchToDetailSingleView();
        } else {
            switchToDetailSideBySideView();
        }
    });

    filterList.addEventListener('click', (event) => {
        if (event.target.tagName === 'LI') {
            if (detailViewContainer.classList.contains('active-content')) {
                closeDetailView();
            }
            document.querySelectorAll('#filter-list .filter-item').forEach(item => item.classList.remove('active'));
            event.target.classList.add('active');
            const filterType = event.target.dataset.filter;
            let filteredPhotos;
            if (filterType === 'all') {
                filteredPhotos = allPhotosData;
            } else {
                filteredPhotos = allPhotosData.filter(photo => photo.animeFilterTag === filterType);
            }
            displayPhotos(filteredPhotos);
        }
    });

    loadPhotoData(); // ★ 最初にデータをロードして処理を開始
});
